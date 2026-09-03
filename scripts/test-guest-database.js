import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export async function guestDatabaseChecks({ owner, admin, barber, otherBarber, a, anon, client, check, value, expectError, p1, p2, normal, tomorrow }) {
  await owner.query(readFileSync('supabase/migrations/202608310004_guest_booking.sql','utf8'));
  const server=await client(null,'service_role');
  const hash=(s)=>createHash('sha256').update(s).digest('hex');
  const args=(hour,extra={})=>{
    const request=randomUUID(), token=randomBytes(32).toString('hex');
    return {token,values:[normal,p1,`${tomorrow}T${hour}:00-05:00`,'Cliente sin cuenta ficticio','+593991234567','cliente@example.com',hash(token),request,hash(request)],...extra};
  };
  const sql='select public.create_guest_booking($1,$2,$3,$4,$5,$6,$7,$8,$9) as value';
  const beforeAuth=await value(owner,'select count(*) as value from auth.users');
  await check('Migración compatible cierra reservas para revisar el gateway y mantiene historial',async()=>{
    assert.equal(await value(owner,'select booking_enabled as value from public.business_settings'),false);
    assert.ok(Number(await value(owner,'select count(*) as value from public.sales'))>0);
    await expectError(()=>a.query('select public.get_identity()'),/NOT_AUTHORIZED/);
    await expectError(()=>a.query('select public.list_appointments()'),/NOT_AUTHORIZED/);
    await expectError(()=>a.query('select public.create_booking($1,$2,$3,$4)',[normal,p1,`${tomorrow}T17:00:00-05:00`,randomUUID()]),/permission denied/);
    assert.equal((await a.query('select * from public.customers')).rowCount,0);
    assert.equal((await value(admin,'select public.get_identity() as value')).role,'admin');
    await owner.query('update public.business_settings set booking_enabled=true');
  });
  const first=args('17:00');let booked;
  await check('Reserva pública guarda los tres datos sin crear usuarios Auth y reintenta sin duplicar',async()=>{
    booked=await value(server,sql,first.values);
    const repeated=await value(server,sql,first.values);assert.equal(booked.id,repeated.id);
    assert.equal(await value(owner,'select count(*) as value from auth.users'),beforeAuth);
    const contact=await value(owner,'select to_jsonb(c) as value from public.customers c join public.appointments a on a.customer_id=c.id where a.id=$1',[booked.id]);
    assert.equal(contact.auth_user_id,null);assert.equal(contact.email,'cliente@example.com');assert.equal(contact.phone,'+593991234567');
    assert.equal(Number(booked.quoted_price),9);
    assert.equal(Number(await value(owner,'select count(*) as value from public.notifications where appointment_id=$1 and active',[booked.id])),2);
    const changed=[...first.values];changed[8]=hash('cambio');await expectError(()=>value(server,sql,changed),/IDEMPOTENCY_CONFLICT/);
  });
  await check('Sin CAPTCHA del servidor no hay acceso directo a RPC públicas de escritura o gestión',async()=>{
    for(const c of [anon,a,barber]){
      await expectError(()=>value(c,sql,args('18:00').values),/permission denied/);
      await expectError(()=>c.query('select public.view_guest_booking($1)',[first.values[6]]),/permission denied/);
      await expectError(()=>c.query('select public.guest_request_gate($1,$2)',[hash('ip'),'create']),/permission denied/);
    }
    await expectError(()=>server.query('select * from private.guest_access'),/permission denied/);
    await expectError(()=>anon.query('select public.get_available_slots($1,$2,$3)',[normal,tomorrow,p1]),/permission denied/);
    assert.ok(Array.isArray(await value(server,'select public.get_available_slots($1,$2,$3) as value',[normal,tomorrow,p2])));
    const result=await value(server,'select public.view_guest_booking($1) as value',[first.values[6]]);
    assert.equal(result.id,booked.id);assert.ok(!('customer_id'in result));assert.ok(!('customer_email'in result));
    await expectError(()=>value(server,'select public.view_guest_booking($1) as value',[hash(booked.id)]),/RESERVATION_NOT_FOUND/);
    await expectError(()=>value(server,'select public.cancel_guest_booking($1,$2) as value',[hash('cliente@example.com'),'Prueba']),/RESERVATION_NOT_FOUND/);
    assert.equal((await value(otherBarber,'select public.list_appointments($1,$2) as value',[tomorrow,p1])).length,0);
    const staffList=await value(barber,'select public.list_appointments($1,$2) as value',[tomorrow,p1]);assert.equal(staffList.find(x=>x.id===booked.id).customer_email,'cliente@example.com');
  });
  await check('Límite de contacto e IP evita crear filas ilimitadas en reintentos',async()=>{
    await value(server,sql,args('18:00').values);await value(server,sql,args('19:00').values);
    const before=await value(owner,'select count(*) as value from public.customers');
    await expectError(()=>value(server,sql,args('20:00').values),/CONTACT_LIMIT/);
    assert.equal(await value(owner,'select count(*) as value from public.customers'),before);
    for(let i=0;i<10;i++)assert.equal(await value(server,'select public.guest_request_gate($1,$2) as value',[hash('ip-ficticia'),'create']),true);
    assert.equal(await value(server,'select public.guest_request_gate($1,$2) as value',[hash('ip-ficticia'),'create']),false);
  });
  await check('Cancelación por enlace mantiene el plazo y es idempotente; no borra la cita',async()=>{
    await owner.query("update public.appointments set cancellation_deadline=clock_timestamp()-interval '1 second' where id=$1",[booked.id]);
    await expectError(()=>value(server,'select public.cancel_guest_booking($1,$2) as value',[first.values[6],'Cambio']),/CANCELLATION_CLOSED/);
    await owner.query("update public.appointments set cancellation_deadline=clock_timestamp()+interval '1 minute' where id=$1",[booked.id]);
    for(let i=0;i<2;i++)assert.equal((await value(server,'select public.cancel_guest_booking($1,$2) as value',[first.values[6],'Cambio'])).status,'cancelled');
    assert.equal(await value(owner,'select active as value from public.calendar_allocations where appointment_id=$1',[booked.id]),false);
  });
  await check('Dos invitados simultáneos conservan exclusión de horarios y no dejan contactos huérfanos',async()=>{
    const one=args('16:00'),two=args('16:00');one.values[4]='+593991234568';one.values[5]='otro1@example.com';two.values[4]='+593991234569';two.values[5]='otro2@example.com';
    const secondServer=await client(null,'service_role');const count=Number(await value(owner,'select count(*) as value from public.customers'));
    const result=await Promise.allSettled([value(server,sql,one.values),value(secondServer,sql,two.values)]);
    assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(Number(await value(owner,'select count(*) as value from public.customers')),count+1);
    assert.equal(await value(owner,'select count(*) as value from auth.users'),beforeAuth);
  });

  await owner.query(readFileSync('supabase/migrations/202609030005_staff_management.sql','utf8'));
  await check('Un administrador vinculado a una agenda sigue disponible como profesional',async()=>{
    const dualUser=await value(owner,'select user_id::text as value from public.professionals where id=$1',[p2]);
    await owner.query("update public.user_roles set role='admin' where user_id=$1",[dualUser]);
    const publicData=await value(anon,'select public.get_bootstrap() as value');
    assert.ok(publicData.professionals.some((professional)=>professional.id===p2));
    assert.equal(await value(owner,"select private.slot_available($1,($2::date+'14:00'::time) at time zone 'America/Guayaquil',45,0) as value",[p2,tomorrow]),true);
  });
  await check('Solo el servidor provisiona personal solicitado por un administrador activo',async()=>{
    const actorId=await value(admin,'select auth.uid()::text as value');
    const barberId=await value(barber,'select auth.uid()::text as value');
    const target=randomUUID();
    await owner.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'nuevo@ficticio.invalid','{}')",[target]);
    await expectError(()=>value(server,"select public.provision_staff($1,$2,'barber','Nuevo ficticio',true,array[$3]::uuid[]) as value",[barberId,target,normal]),/NOT_AUTHORIZED/);
    const result=await value(server,"select public.provision_staff($1,$2,'barber','Nuevo ficticio',true,array[$3]::uuid[]) as value",[actorId,target,normal]);
    assert.equal(result.role,'barber');assert.ok(result.professional_id);
    assert.equal(await value(owner,'select active as value from public.professionals where user_id=$1',[target]),false);
    assert.equal(Number(await value(owner,'select count(*) as value from public.professional_services where professional_id=$1',[result.professional_id])),1);
    assert.equal(Number(await value(owner,'select count(*) as value from public.professional_services where professional_id=$1',[p1])),4);
    assert.equal(await value(server,'select public.staff_management_version() as value'),1);
    await expectError(()=>value(server,"select public.provision_staff($1,$2,'admin','Duplicado',false,array[]::uuid[]) as value",[actorId,target]),/STAFF_EXISTS/);
    await expectError(()=>value(admin,"select public.provision_staff($1,$2,'admin','No permitido',false,array[]::uuid[]) as value",[actorId,randomUUID()]),/permission denied/);
    const settings=await value(admin,'select public.get_settings() as value');
    await value(admin,'select public.update_settings($1,$2) as value',[settings.business,randomUUID()]);
    assert.equal(await value(owner,'select booking_enabled as value from public.business_settings'),true);
    const weekday=await value(owner,'select extract(dow from $1::date)::integer as value',[tomorrow]);
    await value(admin,'select public.update_professional($1,$2,true,$3,$4) as value',[result.professional_id,'Nuevo ficticio',JSON.stringify([{weekday,start_time:'09:00',end_time:'21:00'}]),randomUUID()]);
    await value(admin,'select public.update_settings($1,$2) as value',[settings.business,randomUUID()]);
    assert.equal((await value(anon,'select public.get_bootstrap() as value')).professionals.length,3);
  });
}
