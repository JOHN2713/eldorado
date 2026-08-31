import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Puerto ocupado: la API falla y nunca anuncia que esta lista', { timeout: 12000 }, async () => {
  const occupied = createServer();
  await new Promise((resolve, reject) => {
    occupied.once('error', reject);
    occupied.listen(0, '127.0.0.1', resolve);
  });
  const port = occupied.address().port;
  let child;
  try {
    // No .env file or real credentials. Keep the collision port bound for the entire test.
    const env = { ...process.env, PORT: String(port) };
    for (const key of Object.keys(env)) {
      if (/^(SUPABASE_|VITE_SUPABASE_|TURNSTILE_|PUBLIC_APP_ORIGIN$|TRUST_PROXY_CIDRS$|NODE_OPTIONS$)/.test(key)) delete env[key];
    }
    child = spawn(process.execPath, ['server/index.js', '--api-only'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), env,
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('La API no termino despues del error de puerto.')); }, 8000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('close', (exitCode) => { clearTimeout(timer); resolve(exitCode); });
    });
    assert.equal(code, 1);
    assert.doesNotMatch(stdout, /El Dorado listo/);
    assert.match(stderr, new RegExp(`puerto ${port} ya está ocupado`));
  } finally {
    child?.kill();
    await new Promise((resolve) => occupied.close(resolve));
  }
});
