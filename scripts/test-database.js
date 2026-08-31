// Creates and stops its OWN disposable PostgreSQL cluster; never connects to an existing database.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { guestDatabaseChecks } from './test-guest-database.js';

const bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/14/bin' : '');
const executable = (name) => bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const run = (name, args) => {
  const r = spawnSync(executable(name), args, { encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: name === 'pg_ctl' ? 'ignore' : 'pipe' });
  if (r.error || r.status !== 0) throw new Error(`${name}: ${r.error?.message || r.stderr || r.stdout}`);
};
const probe = createServer();
await new Promise((ok, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', ok); });
const port = probe.address().port;
await new Promise((ok) => probe.close(ok));
const folder = resolve('.test-db', `run-${Date.now()}`);
mkdirSync(folder, { recursive: true });
let started = false, passed = 0;
const clients = [];
const client = async (user, role = 'authenticated') => {
  const c = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await c.connect(); clients.push(c);
  if (role !== 'postgres') await c.query(`set role ${role}`);
  if (user) await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  return c;
};
const value = async (c, sql, args = []) => (await c.query(sql, args)).rows[0]?.value;
const expectError = async (fn, pattern) => assert.rejects(fn, pattern);
const check = async (name, fn) => { await fn(); passed++; console.log(`OK ${passed}: ${name}`); };
const ids = { admin: randomUUID(), barber: randomUUID(), otherBarber: randomUUID(), a: randomUUID(), b: randomUUID() };
const normal = '10000000-0000-0000-0000-000000000001', full = '10000000-0000-0000-0000-000000000004';
const p1 = '20000000-0000-0000-0000-000000000001', p2 = '20000000-0000-0000-0000-000000000002';
try {
  run('initdb', ['-D', join(folder, 'data'), '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale']);
  run('pg_ctl', ['-D', join(folder, 'data'), '-l', join(folder, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  const owner = await client(null, 'postgres');
  await owner.query(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  // First validate the upgrade baseline, then apply 004 and test the new contract.
  for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && f < '202608310004').sort()) {
    await owner.query(readFileSync(join('supabase/migrations', file), 'utf8'));
    console.log(`Migración aplicada: ${file}`);
  }
  const anon = await client(null, 'anon');
  await check('Instalación cerrada: no horarios públicos antes de configurar', async () => {
    const b = await value(anon, 'select public.get_bootstrap() as value');
    assert.equal(b.business.booking_enabled, false); assert.equal(b.professionals.length, 0);
    assert.deepEqual(b.services.map((s) => Number(s.price)), [5,6,6.5,8]);
    await expectError(() => anon.query('select * from public.appointments'), /permission denied/);
  });
  for (const [name, id] of Object.entries(ids)) await owner.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${name}@ficticio.invalid`, { full_name: `Ficticio ${name}`, role: 'admin' }]);
  await owner.query("insert into public.user_roles(user_id,role) values($1,'admin'),($2,'barber'),($3,'barber')", [ids.admin, ids.barber, ids.otherBarber]);
  await owner.query("update public.professionals set user_id=case when id=$1 then $3::uuid else $4::uuid end,name=case when id=$1 then 'Ficticio A' else 'Ficticio B' end,active=true where id in($1,$2)", [p1,p2,ids.barber,ids.otherBarber]);
  await owner.query("insert into public.professional_services select p.id,s.id from public.professionals p cross join public.services s; insert into public.working_intervals select p.id,d,'09:00'::time,'21:00'::time from public.professionals p cross join generate_series(0,6) d; update public.business_settings set booking_enabled=true");
  const admin = await client(ids.admin), barber = await client(ids.barber), otherBarber = await client(ids.otherBarber), a = await client(ids.a), b = await client(ids.b);
  const tomorrow = await value(owner, "select ((clock_timestamp() at time zone 'America/Guayaquil')::date+1)::text as value");
  const time = (hour) => `${tomorrow}T${hour}:00-05:00`;
  const book = (c, professional, hour, key = randomUUID(), service = normal) => value(c, 'select public.create_booking($1,$2,$3,$4) as value', [service,professional,time(hour),key]);
  await check('Metadata no eleva privilegios; RLS y RPC bloquean acceso administrativo', async () => {
    assert.equal((await value(a,'select public.get_identity() as value')).role, 'customer');
    await expectError(() => a.query('select public.get_settings()'), /NOT_AUTHORIZED/);
    await expectError(() => a.query("insert into public.user_roles(user_id,role) values($1,'admin')",[ids.a]), /permission denied/);
    await expectError(() => a.query("select private.expire_no_shows()"), /permission denied/);
  });
  let reserved, winner, loser;
  await check('Dos reservas simultáneas: solo una ocupa al mismo peluquero', async () => {
    const r = await Promise.allSettled([book(a,p1,'10:00'),book(b,p1,'10:00')]);
    assert.equal(r.filter((x) => x.status==='fulfilled').length,1);
    const index = r.findIndex((x) => x.status==='fulfilled'); reserved = r[index].value; winner = index ? b : a; loser = index ? a : b;
    assert.match(r[1-index].reason.message,/SLOT_UNAVAILABLE|exclusion constraint/);
  });
  await check('Otros peluqueros admiten el mismo horario; los intervalos son semiabiertos', async () => {
    await book(loser,p2,'10:00');
    await expectError(() => book(loser,p1,'10:40'), /SLOT_UNAVAILABLE/);
    await book(loser,p1,'10:45');
    await expectError(() => book(loser,p1,'20:05',randomUUID(),full), /SLOT_UNAVAILABLE/);
  });
  await check('Idempotencia evita duplicar reservas y rechaza reutilizar clave con otros datos', async () => {
    const key = randomUUID(); const first = await book(winner,p1,'12:00',key);
    assert.equal((await book(winner,p1,'12:00',key)).id,first.id);
    await expectError(() => book(winner,p1,'13:00',key), /IDEMPOTENCY_CONFLICT/);
  });
  await check('RLS no expone citas o clientes ajenos; un peluquero solo ve su agenda', async () => {
    assert.equal((await loser.query('select * from public.appointments where id=$1',[reserved.id])).rowCount,0);
    assert.equal((await otherBarber.query('select * from public.appointments where id=$1',[reserved.id])).rowCount,0);
    assert.equal((await barber.query('select * from public.appointments where id=$1',[reserved.id])).rowCount,1);
    assert.equal((await loser.query('select * from public.customers where id=$1',[reserved.customer_id])).rowCount,0);
    await expectError(() => value(loser,'select public.cancel_booking($1,$2,$3) as value',[reserved.id,'No es mía',randomUUID()]),/NOT_AUTHORIZED/);
  });
  await check('Descansos rechazan cruces, ocultan motivos al público y respetan permisos', async () => {
    const breakSQL = 'select public.create_break($1,$2,$3,$4,$5,$6) as value';
    await expectError(() => value(otherBarber,breakSQL,[p1,tomorrow,'11:00','11:30','Almuerzo',randomUUID()]),/NOT_AUTHORIZED/);
    await expectError(() => value(barber,breakSQL,[p1,tomorrow,'10:15','10:30','Almuerzo',randomUUID()]),/SLOT_UNAVAILABLE/);
    const pause = await value(barber,breakSQL,[p1,tomorrow,'14:00','15:00','Motivo privado',randomUUID()]);
    await expectError(() => book(winner,p1,'14:30'),/SLOT_UNAVAILABLE/);
    const slots = await value(anon,'select public.get_available_slots($1,$2,$3) as value',[normal,tomorrow,p1]);
    assert.ok(slots.every((s) => Object.keys(s).sort().join(',')==='professional_id,starts_at'));
    assert.ok(!JSON.stringify(slots).includes('Motivo privado'));
    await value(barber,'select public.remove_break($1,$2) as value',[pause.id,randomUUID()]);
    await book(winner,p1,'14:30');
  });
  await check('Cancelación vencida se rechaza; cancelación válida libera ocupación', async () => {
    await owner.query("update public.appointments set cancellation_deadline=clock_timestamp()-interval '1 second' where id=$1",[reserved.id]);
    await expectError(() => value(winner,'select public.cancel_booking($1,$2,$3) as value',[reserved.id,'Cambio',randomUUID()]),/CANCELLATION_CLOSED/);
    await owner.query("update public.appointments set cancellation_deadline=clock_timestamp()+interval '1 minute' where id=$1",[reserved.id]);
    await value(winner,'select public.cancel_booking($1,$2,$3) as value',[reserved.id,'Cambio de planes',randomUUID()]);
    assert.equal(await value(owner,'select active as value from public.calendar_allocations where appointment_id=$1',[reserved.id]),false);
  });
  await check('Reprogramación conserva la cita al fallar e invalida versión anterior al cambiar', async () => {
    const original=await value(owner,"select to_jsonb(a) as value from public.appointments a where professional_id=$1 and starts_at=$2",[p1,time('12:00')]);
    await expectError(() => value(barber,'select public.reschedule_booking($1,$2,$3,$4,$5) as value',[original.id,original.revision,tomorrow,'10:45',randomUUID()]),/SLOT_UNAVAILABLE/);
    assert.equal(await value(owner,'select starts_at::text as value from public.appointments where id=$1',[original.id]),await value(owner,'select $1::timestamptz::text as value',[time('12:00')]));
    await value(barber,'select public.reschedule_booking($1,$2,$3,$4,$5) as value',[original.id,original.revision,tomorrow,'13:00',randomUUID()]);
    assert.equal(await value(owner,'select schedule_version as value from public.appointments where id=$1',[original.id]),2);
    assert.equal(Number(await value(owner,'select count(*) as value from public.notifications where appointment_id=$1 and schedule_version=1 and active',[original.id])),0);
    await expectError(() => value(barber,'select public.reschedule_booking($1,$2,$3,$4,$5) as value',[original.id,original.revision,tomorrow,'13:00',randomUUID()]),/STALE_VERSION/);
  });
  await check('Atención sin cita comprueba espacio, registra llegada y finalización por separado', async () => {
    // A test-only timezone places "now" around midday, making this test independent of runner time.
    const utcHour=Number(await value(owner,"select extract(hour from clock_timestamp() at time zone 'UTC') as value"));
    const offset=utcHour-12, zone=`Etc/GMT${offset>=0?'+':''}${offset}`;
    await owner.query('update public.business_settings set timezone=$1',[zone]);
    const walk=await value(barber,'select public.register_walk_in($1,$2,$3,$4) as value',[p1,normal,'Cliente ficticio sin cita',randomUUID()]);
    assert.ok(walk.visit_id);
    await expectError(() => value(barber,'select public.register_walk_in($1,$2,$3,$4) as value',[p1,normal,'Otro cliente ficticio',randomUUID()]),/SLOT_UNAVAILABLE/);
    await value(barber,'select public.transition_appointment($1,$2,$3) as value',[walk.id,'finish',randomUUID()]);
    assert.equal(await value(owner,'select status as value from public.visits where id=$1',[walk.visit_id]),'completed');
    assert.equal(Number(await value(owner,'select count(*) as value from public.sales where visit_id=$1',[walk.visit_id])),0);
    // Release only test occupancy so later independent notification fixtures fit.
    await owner.query('update public.calendar_allocations set active=false where appointment_id=$1',[walk.id]);
    await owner.query("update public.business_settings set timezone='America/Guayaquil'");
  });
  const seedAppointment = async (offset,professional=p1, hour=null) => value(owner, `select to_jsonb(private.make_appointment($1,$2,${hour ? '$3::timestamptz' : "clock_timestamp()+($3::integer*interval '1 minute')"},(select id from public.customers where auth_user_id=$4),'online','confirmed')) as value`,[normal,professional,hour||offset,ids.a]);
  await check('Ausencia >5 min libera espacio; llegada registrada evita la anulación', async () => {
    const missed = await seedAppointment(-120), present = await seedAppointment(-60);
    await owner.query("update public.appointments set status='checked_in',checked_in_at=starts_at where id=$1",[present.id]);
    await owner.query('select private.expire_no_shows()');
    assert.equal(await value(owner,'select status as value from public.appointments where id=$1',[missed.id]),'no_show');
    assert.equal(await value(owner,'select status as value from public.appointments where id=$1',[present.id]),'checked_in');
    await expectError(() => value(barber,'select public.transition_appointment($1,$2,$3) as value',[missed.id,'check_in',randomUUID()]),/INVALID_STATE/);
  });
  await check('Recordatorios a -10 min solo a administrador y peluquero asignado, sin duplicación entre pestañas', async () => {
    const near = await seedAppointment(8);
    const visible = await value(admin,'select public.get_notifications() as value');
    assert.ok(visible.some((n) => n.appointment_id===near.id));
    assert.ok((await value(barber,'select public.get_notifications() as value')).some((n) => n.appointment_id===near.id));
    assert.ok(!(await value(otherBarber,'select public.get_notifications() as value')).some((n) => n.appointment_id===near.id));
    await expectError(() => a.query('select public.get_notifications()'),/NOT_AUTHORIZED/);
    const n = visible.find((n) => n.appointment_id===near.id);
    const token = await value(admin,'select public.claim_notification($1) as value',[n.id]); assert.ok(token);
    assert.equal(await value(admin,'select public.claim_notification($1) as value',[n.id]),null);
    await admin.query("select public.ack_notification($1,'presented',$2)",[n.id,token]);
    assert.equal(await value(admin,'select public.claim_notification($1) as value',[n.id]),null);
    const later = await seedAppointment(15,p2);
    assert.ok(!(await value(admin,'select public.get_notifications() as value')).some((n) => n.appointment_id===later.id));
    await owner.query("update public.appointments set status='cancelled' where id=$1",[near.id]);
    assert.ok(!(await value(admin,'select public.get_notifications() as value')).some((n) => n.appointment_id===near.id));
  });
  let sale;
  await check('Cobro sin cita: precio del servidor, idempotencia e historial monetario', async () => {
    const localTime = await value(owner,"select ((clock_timestamp()-interval '1 hour') at time zone 'America/Guayaquil')::text as value");
    const key=randomUUID(), args=[p1,normal,'Cliente ficticio',localTime,'cash','Registro de prueba',key];
    const sql='select public.register_retrospective($1,$2,$3,$4,$5,$6,$7) as value';
    sale=await value(admin,sql,args); assert.equal(Number(sale.total_amount),5);
    assert.equal((await value(admin,sql,args)).id,sale.id);
    await expectError(() => value(barber,sql,[...args.slice(0,6),randomUUID()]),/NOT_AUTHORIZED/);
    await value(admin,'select public.update_service($1,$2,$3,$4,$5) as value',[normal,9,45,0,randomUUID()]);
    assert.equal(Number(await value(owner,'select total_amount as value from public.sales where id=$1',[sale.id])),5);
    assert.equal(Number(await value(owner,'select unit_price as value from public.sale_items where sale_id=$1',[sale.id])),5);
    const visit=await value(owner,'select visit_id as value from public.sales where id=$1',[sale.id]);
    await expectError(() => value(admin,'select public.register_sale($1,$2,$3,$4) as value',[visit,JSON.stringify([{service_id:normal,quantity:1}]),'cash',randomUUID()]),/ALREADY_SOLD/);
    assert.equal((await a.query('select * from public.sales')).rowCount,0);
    await expectError(() => a.query("update public.sales set total_amount=1"),/permission denied/);
  });
  await check('Dashboard reconcilia cobros y anulación mantiene auditoría sin borrar ventas', async () => {
    const dates=await value(owner,"select jsonb_build_array(((clock_timestamp() at time zone 'America/Guayaquil')::date-1)::text,((clock_timestamp() at time zone 'America/Guayaquil')::date)::text) as value");
    const report=await value(admin,'select public.get_sales_dashboard($1,$2) as value',dates);
    assert.equal(Number(report.total),5); assert.equal(report.count,1); assert.equal(report.series.reduce((s,d)=>s+Number(d.total),0),5);
    await value(admin,'select public.void_sale($1,$2,$3) as value',[sale.id,'Corrección de prueba',randomUUID()]);
    const after=await value(admin,'select public.get_sales_dashboard($1,$2) as value',dates);
    assert.equal(Number(after.total),0); assert.equal(after.count,0); assert.equal(after.sales[0].status,'voided');
    assert.equal(Number(await value(owner,"select count(*) as value from public.audit_log where action='sale.void' and entity_id=$1",[sale.id])),1);
  });
  await guestDatabaseChecks({ owner, admin, barber, otherBarber, a, anon, client, check, value, expectError, p1, p2, normal, tomorrow });
  console.log(`\n${passed} comprobaciones críticas aprobadas. Auth simulado; no sustituye pruebas con Supabase real.`);
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  if (started) run('pg_ctl', ['-D', join(folder,'data'), '-m', 'fast', '-w', 'stop']);
}
