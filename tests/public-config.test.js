import test from 'node:test';
import assert from 'node:assert/strict';
import { publicConfiguration } from '../src/services/guest.js';

test('Estado de API: una caida, HTTP 426 o respuesta ajena no se presenta como claves faltantes', async (t) => {
  const responses = [
    async () => { throw new TypeError('network error'); },
    async () => new Response('Upgrade Required', { status: 426 }),
    async () => new Response('<html>Otro servicio</html>'),
    async () => Response.json({ status: 'ok' }),
    async () => Response.json({ ready: 'false' }),
  ];
  for (const response of responses) {
    t.mock.method(globalThis, 'fetch', response);
    assert.deepEqual(await publicConfiguration(), { ready: false, status: 'unreachable' });
    t.mock.restoreAll();
  }
});

test('Estado de API: distingue configuracion incompleta de parametros cargados', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ready: false, captchaSiteKey: null }));
  assert.deepEqual(await publicConfiguration(), { ready: false, captchaSiteKey: null, status: 'configuration_required' });
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ready: true, captchaSiteKey: 'widget-ficticio' }));
  assert.deepEqual(await publicConfiguration(), { ready: true, captchaSiteKey: 'widget-ficticio', status: 'configured' });
});
