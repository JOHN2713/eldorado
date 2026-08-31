import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { guestRouter, normalizeContact, verifyTurnstile, hashToken } from '../server/guest-api.js';

test('Contacto obligatorio: normaliza celular ecuatoriano y correo sin fusionar identidades', () => {
  assert.deepEqual(normalizeContact({name:' Ana  Prueba ',email:' ANA@EXAMPLE.COM ',phone:'099 123 4567'}), {name:'Ana Prueba',email:'ana@example.com',phone:'+593991234567'});
  for (const override of [{name:''},{phone:'123'},{email:'correo-invalido'},{phone:'+593991234567;SQL'}]) assert.throws(() => normalizeContact({name:'Ana Prueba',phone:'0991234567',email:'ana@example.com',...override}),/INVALID_CONTACT/);
});
test('CAPTCHA rechaza replay inválido, dominio o acción distintos; no basta recibir un token', async () => {
  const args={token:'token-ficticio',secret:'secreto-de-prueba',hostname:'barberia.example',requestId:randomUUID()};
  for (const result of [{success:false},{success:true,hostname:'atacante.example',action:'booking'},{success:true,hostname:'barberia.example',action:'otra'}]) await assert.rejects(()=>verifyTurnstile({...args,fetcher:async()=>({ok:true,json:async()=>result})}),/CAPTCHA_REQUIRED/);
  await verifyTurnstile({...args,fetcher:async()=>({ok:true,json:async()=>({success:true,hostname:'barberia.example',action:'booking'})})});
});
test('Tokens privados requieren entropía; un identificador o un correo no autorizan consultas', () => {
  const token=randomBytes(32).toString('hex'); assert.match(hashToken(token),/^[a-f0-9]{64}$/); assert.notEqual(hashToken(token),token);
  assert.throws(()=>hashToken(randomUUID()),/RESERVATION_NOT_FOUND/); assert.throws(()=>hashToken('ana@example.com'),/RESERVATION_NOT_FOUND/);
});
// Exercise the real Express router. External CAPTCHA/DB adapters are controlled stubs, not production bypasses.
async function withAPI(options, action) {
  const app=express();app.use('/api/public',guestRouter(options)); const server=app.listen(0,'127.0.0.1');
  await new Promise((ok,fail)=>{server.once('listening',ok);server.once('error',fail);});
  try { await action(`http://127.0.0.1:${server.address().port}/api/public`); } finally { await new Promise((ok)=>server.close(ok)); }
}
const options={origin:'https://barberia.example',secret:'solo-prueba-no-real',captchaSecret:'solo-prueba',captchaSiteKey:'solo-prueba'};
const payload=()=>({name:'Cliente Ficticio',phone:'0991234567',email:'prueba@example.com',serviceId:randomUUID(),professionalId:randomUUID(),startsAt:'2030-01-01T15:00:00Z',requestId:randomUUID(),managementToken:randomBytes(32).toString('hex'),captchaToken:'ficticio'});
const post=(base,path,body,origin=options.origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
test('Gateway falla cerrado sin configuración; bloquea origen y CAPTCHA antes de crear una cita', async () => {
  await withAPI({}, async(base)=>{assert.equal((await post(base,'/bookings',payload())).status,503);});
  let writes=0;
  await withAPI({...options,rpc:async(name)=>{if(name==='guest_request_gate')return true;writes++;},verify:async()=>{throw new Error('CAPTCHA_REQUIRED');}},async(base)=>{
    assert.equal((await post(base,'/bookings',payload(),'https://otro.example')).status,403);
    assert.notEqual((await post(base,'/bookings',payload())).status,201);
    assert.equal(writes,0);
  });
});
test('Gateway normaliza la URL configurada al origen y rechaza URLs inválidas', async () => {
  const serviceId = randomUUID();
  const rpc = async (name) => name === 'guest_request_gate' ? true : [];
  await withAPI({ ...options, origin: options.origin + '/', rpc }, async (base) => {
    const response = await post(base, '/slots', { serviceId, date: '2030-01-01' });
    assert.equal(response.status, 200);
  });
  await withAPI({ ...options, origin: 'dominio-sin-esquema', rpc }, async (base) => {
    assert.equal((await post(base, '/slots', { serviceId, date: '2030-01-01' })).status, 503);
  });
});
test('Gateway solo transmite hash privado y contacto normalizado; no acepta precio o rol del navegador', async () => {
  let received;
  const input={...payload(),price:0,role:'admin'};
  await withAPI({...options,rpc:async(name,args)=>{if(name==='guest_request_gate')return true;received=args;return {id:'reserva-ficticia'};},verify:async()=>{}},async(base)=>{
    const response=await post(base,'/bookings',input);assert.equal(response.status,201);assert.equal((await response.json()).appointment.id,'reserva-ficticia');
    assert.equal(received.p_phone,'+593991234567');assert.equal(received.p_email,'prueba@example.com');
    assert.equal(received.p_token_hash,hashToken(input.managementToken));assert.ok(!JSON.stringify(received).includes(input.managementToken));assert.ok(!('price' in received));assert.ok(!('role' in received));
  });
});
test('Límite persistido bloquea antes de CAPTCHA y llamadas de escritura', async () => {
  let calls=0, verifies=0;
  await withAPI({...options,rpc:async()=>{calls++;return false;},verify:async()=>{verifies++;}},async(base)=>{
    assert.equal((await post(base,'/bookings',payload())).status,429);assert.equal(calls,1);assert.equal(verifies,0);
  });
});

test('El catalogo inicial permite consultar horarios y reservar con sus UUID de PostgreSQL', async () => {
  const serviceId = '10000000-0000-0000-0000-000000000001';
  const professionalId = '20000000-0000-0000-0000-000000000002';
  const slots = [{ starts_at: '2030-01-01T15:00:00Z', professional_id: professionalId }];
  let bookings = 0;
  await withAPI({ ...options, verify: async () => {}, rpc: async (name, args) => {
    if (name === 'guest_request_gate') return true;
    assert.equal(args.p_service, serviceId);
    assert.equal(args.p_professional, professionalId);
    if (name === 'get_available_slots') return slots;
    if (name === 'create_guest_booking') { bookings++; return { id: 'reserva-ficticia' }; }
    throw new Error('RPC inesperado');
  } }, async (base) => {
    const available = await post(base, '/slots', { serviceId, professionalId, date: '2030-01-01' });
    assert.equal(available.status, 200);
    assert.deepEqual((await available.json()).slots, slots);
    const booked = await post(base, '/bookings', { ...payload(), serviceId, professionalId });
    assert.equal(booked.status, 201);
    assert.equal(bookings, 1);
  });
});

test('Horarios rechazan identificadores malformados antes de consultar disponibilidad', async () => {
  let slotQueries = 0;
  await withAPI({ ...options, rpc: async (name) => {
    if (name === 'guest_request_gate') return true;
    slotQueries++;
    return [];
  } }, async (base) => {
    for (const serviceId of ['', 'servicio', "10000000-0000-0000-0000-000000000001';SQL", 'g0000000-0000-0000-0000-000000000001']) {
      const response = await post(base, '/slots', { serviceId, date: '2030-01-01' });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'INVALID_INPUT');
    }
    assert.equal(slotQueries, 0);
  });
});
