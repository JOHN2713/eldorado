import { createClient } from '@supabase/supabase-js';
import { preview } from '../data/preview.js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function validPublicKey(value) {
  if (!value || value.startsWith('sb_secret_')) return false;
  if (value.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
}
export const configurationError = Boolean(url || key) && (!url?.startsWith('https://') || !validPublicKey(key));
export const configured = Boolean(url && key && !configurationError);
export const supabase = configured ? createClient(url, key) : null;
const errors = {
  INVALID_CONTACT: 'Completa nombre, correo válido y celular. Usa 09XXXXXXXX para Ecuador o +código de país y número.',
  CAPTCHA_REQUIRED: 'Completa nuevamente la verificación de seguridad.',
  CAPTCHA_UNAVAILABLE: 'La verificación de seguridad no está disponible. Intenta nuevamente.',
  PUBLIC_BOOKING_UNAVAILABLE: 'Las reservas públicas aún no están conectadas. Intenta más tarde o contacta al local.',
  RESERVATION_NOT_FOUND: 'El enlace de reserva no es válido o ya venció.',
  CONTACT_LIMIT: 'Ya hay varias reservas próximas con ese contacto. Contacta al local para revisarlas.',
  RATE_LIMITED: 'Se realizaron demasiados intentos. Espera unos minutos y vuelve a intentar.',
  SLOT_UNAVAILABLE: 'Ese horario acaba de ocuparse. Selecciona otro.',
  NOT_AUTHORIZED: 'Tu cuenta no tiene permiso para esta acción.',
  LOGIN_REQUIRED: 'Inicia sesión para continuar.',
  BOOKING_DISABLED: 'Las reservas todavía no están habilitadas.',
  CANCELLATION_CLOSED: 'La cancelación requiere al menos 30 minutos de anticipación.',
  ARRIVAL_EXPIRED: 'Terminó la tolerancia de llegada. Actualiza la agenda.',
  START_TOO_EARLY: 'La llegada está registrada. Espera a la hora reservada para iniciar el corte.',
  INVALID_STATE: 'El estado de la cita cambió. Actualiza la página.',
  STALE_VERSION: 'Otra persona modificó este registro. Actualiza antes de continuar.',
  IDEMPOTENCY_CONFLICT: 'Esta operación ya se utilizó con otros datos. Actualiza e intenta nuevamente.',
  OUTSIDE_WORKING_HOURS: 'El servicio no cabe en la jornada disponible.',
  INVALID_INPUT: 'Revisa los datos. Alguno tiene un formato o valor no permitido.',
  SETUP_INCOMPLETE: 'Falta completar el equipo. Revisa «Qué falta para activar las reservas» y guarda los días y horas de cada peluquero antes de habilitarlas.',
  ALREADY_SOLD: 'Esta atención ya tiene una venta registrada.',
};
export function friendly(error) {
  const msg = error?.message || String(error);
  for (const [code, label] of Object.entries(errors)) if (msg.includes(code)) return label;
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirma tu correo antes de ingresar.';
  if (/fetch|network/i.test(msg)) return 'No se pudo conectar. Revisa tu conexión y vuelve a intentar.';
  return configured ? 'No se pudo completar la operación. Revisa tu configuración o vuelve a intentar.' : 'Conecta Supabase para guardar datos reales. La vista previa no registra operaciones.';
}
export async function rpc(name, params = {}) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}
export async function bootstrap() {
  return configured ? rpc('get_bootstrap') : structuredClone(preview);
}
export async function settingsWithSetup() {
  if (!supabase) throw new Error('Supabase no configurado');
  const settings = await rpc('get_settings'); // Admin permission checked by the server first.
  const [roles, assignments] = await Promise.all([
    supabase.from('user_roles').select('user_id,role,active'),
    supabase.from('professional_services').select('professional_id,service_id'),
  ]);
  // A failed read is not equivalent to an empty configuration.
  if (roles.error || assignments.error) return { ...settings, setup: null };
  return { ...settings, setup: { roles: roles.data, assignments: assignments.data } };
}
export async function identity() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try { return await rpc('get_identity'); }
  catch (error) {
    if (error.message?.includes('NOT_AUTHORIZED')) { await supabase.auth.signOut(); return null; }
    throw error;
  }
}
export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
