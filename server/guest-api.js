import express from 'express';
import { createHash, createHmac } from 'node:crypto';

export class PublicError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
const sha = (value) => createHash('sha256').update(value).digest('hex');
// PostgreSQL UUIDs and the seeded IDs need not carry RFC version/variant bits.
// Syntax validation never grants access; SQL still validates each referenced entity.
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function normalizeContact(input) {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  let phone = typeof input.phone === 'string' ? input.phone.trim().replace(/[ ()-]/g, '') : '';
  if (/^09\d{8}$/.test(phone)) phone = '+593' + phone.slice(1);
  if (name.length < 2 || name.length > 100 || /[\u0000-\u001f]/.test(name) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+[1-9]\d{7,14}$/.test(phone)) throw new PublicError('INVALID_CONTACT');
  return { name, email, phone };
}
export const hashToken = (token) => {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new PublicError('RESERVATION_NOT_FOUND', 404);
  return sha(token);
};
function normalizeOrigin(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch { return ''; }
}
export async function verifyTurnstile({ token, secret, hostname, requestId, fetcher = fetch }) {
  if (typeof token !== 'string' || !token || token.length > 2048) throw new PublicError('CAPTCHA_REQUIRED');
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret, response: token, idempotency_key: requestId }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new PublicError('CAPTCHA_UNAVAILABLE', 503);
  const result = await response.json();
  if (!result.success || result.action !== 'booking' || result.hostname !== hostname) throw new PublicError('CAPTCHA_REQUIRED');
}

// No user ID, email or phone alone ever authorizes reading/cancelling a reservation.
export function guestRouter({ rpc, origin, secret, captchaSecret, captchaSiteKey, verify = verifyTurnstile, now = Date.now }) {
  const router = express.Router();
  const allowedOrigin = normalizeOrigin(origin);
  const ready = Boolean(rpc && allowedOrigin && secret && captchaSecret && captchaSiteKey);
  const memory = new Map();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/config', (_req, res) => res.json({ ready, captchaSiteKey: ready ? captchaSiteKey : null }));
  router.use((req, res, next) => {
    if (!ready) return res.status(503).json({ error: 'PUBLIC_BOOKING_UNAVAILABLE' });
    if (req.method !== 'POST' || req.get('origin') !== allowedOrigin) return res.status(403).json({ error: 'NOT_AUTHORIZED' });
    const clock = now();
    // Bounded local protection before JSON parsing, CAPTCHA calls and database traffic.
    for (const [key, entry] of memory) if (entry.until <= clock) memory.delete(key);
    const subject = createHmac('sha256', secret).update(req.ip || 'unknown').digest('hex');
    const entry = memory.get(subject) || { count: 0, until: clock + 60000 };
    if ((!memory.has(subject) && memory.size >= 10000) || ++entry.count > 30) return res.status(429).set('Retry-After','60').json({ error: 'RATE_LIMITED' });
    memory.set(subject, entry); req.guestSubject = subject; next();
  });
  router.use(express.json({ limit: '8kb', strict: true }));
  router.use(async (req, _res, next) => {
    try {
      if (!['/slots','/bookings','/booking/view','/booking/cancel'].includes(req.path)) throw new PublicError('NOT_FOUND',404);
      if (!await rpc('guest_request_gate', { p_subject: req.guestSubject, p_kind: req.path === '/bookings' ? 'create' : 'manage' })) throw new PublicError('RATE_LIMITED',429);
      next();
    } catch (error) { next(error); }
  });
  router.post('/slots', async (req, res, next) => {
    try {
      const input=req.body || {};
      if (!uuid.test(input.serviceId || '') || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || (input.professionalId && !uuid.test(input.professionalId))) throw new PublicError('INVALID_INPUT');
      res.json({ slots: await rpc('get_available_slots', { p_service: input.serviceId, p_date: input.date, p_professional: input.professionalId || null }) });
    } catch(error) { next(error); }
  });
  router.post('/bookings', async (req, res, next) => {
    try {
      const input = req.body || {}, contact = normalizeContact(input);
      if (!uuid.test(input.requestId || '') || !uuid.test(input.serviceId || '') || !uuid.test(input.professionalId || '') || typeof input.startsAt !== 'string' || !Number.isFinite(Date.parse(input.startsAt))) throw new PublicError('INVALID_INPUT');
      const tokenHash = hashToken(input.managementToken);
      await verify({ token: input.captchaToken, secret: captchaSecret, hostname: new URL(allowedOrigin).hostname, requestId: input.requestId });
      const body = { p_service: input.serviceId, p_professional: input.professionalId, p_start: new Date(input.startsAt).toISOString(), p_name: contact.name, p_phone: contact.phone, p_email: contact.email, p_token_hash: tokenHash, p_request_id: input.requestId };
      const appointment = await rpc('create_guest_booking', { ...body, p_request_hash: sha(JSON.stringify(body)) });
      res.status(201).json({ appointment });
    } catch (error) { next(error); }
  });
  router.post('/booking/view', async (req, res, next) => {
    try { res.json({ appointment: await rpc('view_guest_booking', { p_token_hash: hashToken(req.body?.token) }) }); } catch (error) { next(error); }
  });
  router.post('/booking/cancel', async (req, res, next) => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (reason.length>200) throw new PublicError('INVALID_INPUT');
      res.json({ appointment: await rpc('cancel_guest_booking', { p_token_hash: hashToken(req.body?.token), p_reason: reason }) });
    } catch (error) { next(error); }
  });
  router.use((error, _req, res, _next) => {
    // Never log request bodies, contacts, bearer links, raw SQL messages or credentials.
    const allowed = ['RESERVATION_NOT_FOUND','SLOT_UNAVAILABLE','BOOKING_DISABLED','INVALID_INPUT','IDEMPOTENCY_CONFLICT','CONTACT_LIMIT','CANCELLATION_CLOSED','INVALID_STATE'];
    const code = error instanceof PublicError ? error.message : allowed.find((x) => error.message?.includes(x)) || (error.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : error.type === 'entity.parse.failed' ? 'INVALID_INPUT' : 'PUBLIC_BOOKING_UNAVAILABLE');
    const status = error.status || (code === 'RESERVATION_NOT_FOUND' ? 404 : code === 'PUBLIC_BOOKING_UNAVAILABLE' ? 503 : 400);
    res.status(status).json({ error: code });
  });
  return router;
}
