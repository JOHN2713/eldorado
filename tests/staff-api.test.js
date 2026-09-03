import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createStaffService, normalizeStaff, staffRouter } from '../server/staff-api.js';

test('Alta de personal valida correo, rol, nombre y servicios', () => {
  const serviceId = randomUUID();
  assert.deepEqual(normalizeStaff({ email: ' NUEVO@EXAMPLE.COM ', name: ' Ana  Prueba ', role: 'barber', professional: false, serviceIds: [serviceId, serviceId] }), {
    email: 'nuevo@example.com', name: 'Ana Prueba', role: 'barber', professional: true, serviceIds: [serviceId],
  });
  assert.throws(() => normalizeStaff({ email: 'incorrecto', name: 'Ana', role: 'admin' }), /INVALID_INPUT/);
  assert.throws(() => normalizeStaff({ email: 'ana@example.com', name: 'Ana', role: 'barber', serviceIds: [] }), /SERVICES_REQUIRED/);
  assert.throws(() => normalizeStaff({ email: 'ana@example.com', name: 'Ana', role: 'owner', serviceIds: [] }), /INVALID_INPUT/);
});

async function withAPI(service, action) {
  const app = express();
  app.use('/api/staff', staffRouter({ service, origin: 'https://barberia.example/' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await action(`http://127.0.0.1:${server.address().port}/api/staff`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

const request = (base, path, { method = 'GET', token, origin = 'https://barberia.example', body } = {}) => fetch(base + path, {
  method,
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

test('Administración de usuarios falla cerrada y exige un administrador autenticado', async () => {
  let lists = 0;
  const service = { authenticate: async (token) => token === 'admin' ? { id: randomUUID() } : null, list: async () => { lists++; return []; }, create: async () => ({}) };
  await withAPI(service, async (base) => {
    assert.equal((await request(base, '/users')).status, 401);
    assert.equal((await request(base, '/users', { token: 'barber' })).status, 403);
    assert.equal((await request(base, '/users', { token: 'admin' })).status, 200);
    assert.equal(lists, 1);
  });
  await withAPI(null, async (base) => assert.equal((await request(base, '/users', { token: 'admin' })).status, 503));
});

test('Solo el origen configurado puede crear; el servidor decide el actor', async () => {
  const actor = randomUUID(), serviceId = randomUUID();
  let received;
  const service = { authenticate: async () => ({ id: actor }), list: async () => [], create: async (input, actorId) => { received = { input, actorId }; return { invited: true, user: { email: input.email } }; } };
  const body = { email: 'nuevo@example.com', name: 'Nuevo Barbero', role: 'barber', serviceIds: [serviceId], actorId: randomUUID() };
  await withAPI(service, async (base) => {
    assert.equal((await request(base, '/users', { method: 'POST', token: 'admin', origin: 'https://otro.example', body })).status, 403);
    const response = await request(base, '/users', { method: 'POST', token: 'admin', body });
    assert.equal(response.status, 201);
    assert.equal(received.actorId, actor);
    assert.ok(!('actorId' in received.input));
  });
});

test('Un acceso activo duplicado se informa como conflicto sin filtrar errores internos', async () => {
  const service = { authenticate: async () => ({ id: randomUUID() }), list: async () => [], create: async () => { throw new Error('STAFF_EXISTS: detalle privado'); } };
  await withAPI(service, async (base) => {
    const response = await request(base, '/users', { method: 'POST', token: 'admin', body: { email: 'admin@example.com', name: 'Admin', role: 'admin', serviceIds: [] } });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'STAFF_EXISTS' });
  });
});

test('No se envían invitaciones antes de instalar la migración de personal', async () => {
  let invitations = 0;
  const database = {
    rpc: async () => ({ data: null, error: new Error('function missing') }),
    auth: { admin: { inviteUserByEmail: async () => { invitations++; } } },
  };
  const service = createStaffService(database, 'https://barberia.example');
  await assert.rejects(() => service.create({ email: 'nuevo@example.com', name: 'Nuevo', role: 'admin' }, randomUUID()), /STAFF_MANAGEMENT_UNAVAILABLE/);
  assert.equal(invitations, 0);
});
