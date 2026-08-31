import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const probe = createServer();
await new Promise((ok, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', ok); });
const port = probe.address().port;
await new Promise((ok) => probe.close(ok));
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore','pipe','pipe'], windowsHide: true });
let errors = '';
server.stderr.on('data', (chunk) => { errors += chunk.toString(); });
try {
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('No inició el servidor de prueba. ' + errors)), 10000);
    server.once('error', (e) => { clearTimeout(timer); fail(e); });
    server.once('exit', (code) => { clearTimeout(timer); fail(new Error(`Servidor terminó con ${code}: ${errors}`)); });
    server.stdout.once('data', () => { clearTimeout(timer); ok(); });
  });
  const base = `http://127.0.0.1:${port}`;
  assert.deepEqual(await (await fetch(base + '/health')).json(), { status: 'ok' });
  for (const route of ['/reservar', '/panel/agenda', '/ingresar']) assert.equal((await fetch(base + route)).status, 200);
  assert.equal((await fetch(base + '/missing.js')).status, 404);
  const response = await fetch(base + '/');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(await response.text(), /El Dorado/);
  console.log('Servidor de producción: health, rutas SPA, recursos 404 y cabeceras correctos.');
} finally { server.kill(); }
