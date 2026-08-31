export async function guestRequest(path, body) {
  const response = await fetch(`/api/public/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', ...(path === 'config' ? { signal: AbortSignal.timeout(6000) } : {}) });
  let result;
  try { result = await response.json(); } catch { throw new Error('PUBLIC_BOOKING_UNAVAILABLE'); }
  if (!response.ok) throw new Error(result.error || 'PUBLIC_BOOKING_UNAVAILABLE');
  return result;
}
export async function publicConfiguration() {
  try {
    const config = await guestRequest('config');
    if (typeof config?.ready !== 'boolean' || (config.ready && typeof config.captchaSiteKey !== 'string')) throw new Error('INVALID_API_RESPONSE');
    return { ...config, status: config.ready ? 'configured' : 'configuration_required' };
  } catch { return { ready: false, status: 'unreachable' }; }
}
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2,'0')).join('');
let pending;
export async function guestAttempt(payload) {
  const signature = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))));
  if (!pending) { try { pending = JSON.parse(sessionStorage.getItem('eldorado:pending') || 'null'); } catch { /* Memory works if browser storage is blocked. */ } }
  if (pending?.signature !== signature) pending = { signature, requestId: crypto.randomUUID(), managementToken: hex(crypto.getRandomValues(new Uint8Array(32))) };
  try { sessionStorage.setItem('eldorado:pending', JSON.stringify(pending)); } catch { /* Retry survives in this page only. */ }
  return { requestId: pending.requestId, managementToken: pending.managementToken };
}
export function clearGuestAttempt() { pending = null; try { sessionStorage.removeItem('eldorado:pending'); } catch {} }
export function reservationToken(value = location.hash.slice(1)) {
  const raw = value.trim();
  if (/^[a-f0-9]{64}$/.test(raw)) return raw;
  try { const url = new URL(raw); if (url.origin === location.origin && url.pathname === '/mi-reserva' && /^[a-f0-9]{64}$/.test(url.hash.slice(1))) return url.hash.slice(1); } catch {}
  return '';
}
let apiPromise, widget;
export function removeCaptcha() { if (widget !== undefined && window.turnstile) window.turnstile.remove(widget); widget = undefined; }
export function resetCaptcha() { if (widget !== undefined && window.turnstile) window.turnstile.reset(widget); }
export async function mountCaptcha(siteKey) {
  const target = document.querySelector('#booking-captcha');
  if (!target || !siteKey) return;
  try {
    if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
      script.onload = resolve; script.onerror = () => { apiPromise = undefined; script.remove(); reject(new Error('CAPTCHA_UNAVAILABLE')); }; document.head.append(script);
    });
    await apiPromise;
    if (!target.isConnected) return;
    const input = target.closest('form').elements.captchaToken;
    widget = window.turnstile.render(target, { sitekey: siteKey, theme: 'dark', action: 'booking', size: 'flexible', 'response-field': false,
      callback: (token) => { input.value = token; }, 'expired-callback': () => { input.value = ''; }, 'error-callback': () => { input.value = ''; target.nextElementSibling.textContent = 'No se pudo verificar. Recarga o intenta nuevamente.'; },
    });
  } catch { if (target.isConnected) target.textContent = 'No se pudo cargar la verificación. Revisa tu conexión y recarga.'; }
}
