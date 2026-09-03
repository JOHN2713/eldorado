import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { guestRouter } from './guest-api.js';
import { createStaffService, staffRouter } from './staff-api.js';
import { LOCAL_API_HOST, LOCAL_API_PORT } from '../config/local-development.js';

const app = express();
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
app.disable('x-powered-by');
// Configure only verified proxy CIDRs at deployment; never trust arbitrary forwarding headers.
if (process.env.TRUST_PROXY_CIDRS) app.set('trust proxy', process.env.TRUST_PROXY_CIDRS.split(',').map((s) => s.trim()));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
const serverKey = process.env.SUPABASE_SECRET_KEY;
const serverURL = process.env.SUPABASE_URL;
const database = serverKey && serverURL ? createClient(serverURL, serverKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
app.use('/api/public', guestRouter({
  rpc: database ? async (name, args) => { const { data, error } = await database.rpc(name, args); if (error) throw error; return data; } : null,
  origin: process.env.PUBLIC_APP_ORIGIN,
  secret: serverKey,
  captchaSecret: process.env.TURNSTILE_SECRET_KEY,
  captchaSiteKey: process.env.TURNSTILE_SITE_KEY,
}));
app.use('/api/staff', staffRouter({
  service: createStaffService(database, process.env.PUBLIC_APP_ORIGIN),
  origin: process.env.PUBLIC_APP_ORIGIN,
}));
app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get('/{*path}', (req, res) => {
  if (path.extname(req.path)) return res.sendStatus(404);
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});
const apiOnly = process.argv.includes('--api-only');
const port = Number(process.env.PORT || (apiOnly ? LOCAL_API_PORT : 3000));
const host = apiOnly ? LOCAL_API_HOST : '0.0.0.0';
app.listen(port, host, (error) => {
  // Express 5 passes listen errors to this callback, including occupied ports.
  if (error) {
    console.error(error.code === 'EADDRINUSE'
      ? `No se pudo iniciar El Dorado: el puerto ${port} ya está ocupado. No se inició otra API. Revisa el proceso que lo usa antes de reintentar.`
      : `No se pudo iniciar El Dorado en el puerto ${port}. Revisa los permisos y la configuración de red.`);
    process.exitCode = 1;
    return;
  }
  console.log(`El Dorado listo en http://${host}:${port}${apiOnly ? ' (API local)' : ''}. Mantén esta terminal abierta.`);
});
