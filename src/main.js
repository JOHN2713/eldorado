import './styles.css';
import { icon } from './lib/icons.js';
import { money, escapeHtml as e, dateKey, timeLabel, longDate, shiftDate, periodRange, statusLabels, paymentLabels, mayCancel, icsEvent, googleCalendarUrl } from './lib/domain.js';
import { configured, configurationError, supabase, bootstrap, identity, rpc, friendly, signIn, settingsWithSetup } from './services/api.js';
import { professionalSetupIssues } from './lib/booking-setup.js';
import { authModeFromLocationHash } from './lib/auth-link.js';
import { LOCAL_API_PORT } from '../config/local-development.js';

import { guestRequest, publicConfiguration, guestAttempt, clearGuestAttempt, reservationToken, mountCaptcha, removeCaptcha, resetCaptcha } from './services/guest.js';

const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const state = { data: null, me: null, path: location.pathname, booking: { step: 1, date: dateKey(), professional: '', service: '', slot: null }, slots: [], appointments: [], sales: [], breaks: [], notifications: [], authMode: authModeFromLocationHash(location.hash), date: dateKey(), period: 'week', from: periodRange('week')[0], to: periodRange('week')[1] };
state.publicConfig = { ready: false };
state.contact = { name: '', phone: '', email: '' };
let renderVersion = 0;
let notificationBusy = false;
const actionKeys = new Map();
const mutation = (name, args = {}) => {
  const signature = name + JSON.stringify(args);
  if (!actionKeys.has(signature)) actionKeys.set(signature, crypto.randomUUID());
  return rpc(name, { ...args, p_key: actionKeys.get(signature) }).then((value) => { actionKeys.delete(signature); return value; });
};
const field = (label, name, type = 'text', value = '', extra = '') => `<label class="field">${e(label)}<input type="${type}" name="${name}" value="${e(value)}" ${extra}></label>`;
const select = (label, name, options, value = '') => `<label class="field">${e(label)}<select name="${name}">${options.map(([id, text]) => `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(text)}</option>`).join('')}</select></label>`;
const empty = (text, glyph = 'calendar') => `<div class="empty-state">${icon(glyph)}<div>${e(text)}</div></div>`;
const isStaff = () => ['admin', 'barber'].includes(state.me?.role);
const isAdmin = () => state.me?.role === 'admin';
const serviceById = (id) => state.data.services.find((s) => s.id === id);
const professionalOptions = () => state.data.professionals.map((p) => [p.id, p.name]);
const serviceOptions = () => state.data.services.map((s) => [s.id, `${s.name} · ${money(s.price)}`]);
const staffSelect = (label = 'Peluquero', name = 'professional_id') => select(label, name, isAdmin() || !configured ? professionalOptions() : professionalOptions().filter(([id]) => id === state.me?.professional_id), state.me?.professional_id || '');

function header() {
  return `<header class="site-header"><a href="/" data-nav class="brand" aria-label="El Dorado, inicio"><span class="brand-mark">${icon('crown')}</span><span><strong>EL DORADO</strong><small>BARBERÍA</small></span></a><nav class="top-nav" aria-label="Navegación principal"><a class="nav-link ${['/', '/reservar'].includes(state.path) ? 'active' : ''}" data-nav href="/reservar">Agendar una cita</a><a class="nav-link ${state.path === '/mis-citas' ? 'active' : ''}" data-nav href="/mi-reserva">Mi reserva</a>${isStaff() || !configured ? '<a data-nav class="nav-link" href="/panel/agenda">Panel del negocio</a>' : ''}${isStaff() ? `<button class="icon-button" data-action="notifications" aria-label="Ver recordatorios">${icon('bell')}</button>` : ''}${state.me ? `<button class="outline-button" data-action="logout">Salir</button>` : `<a class="outline-button" data-nav href="/ingresar">${icon('user')} Acceso del equipo</a>`}</nav></header>${!configured ? `<div class="preview-bar">${configurationError ? 'Configuración incompleta o clave no pública. Revisa .env.local.' : 'Vista previa · Supabase aún no está conectado. No se guardan reservas ni ventas.'}</div>` : ''}`;
}
function footer() { return `<footer class="site-footer"><span>© ${new Date().getFullYear()} ${e(state.data?.business.name || 'El Dorado Barbería')}</span><span>${e(state.data?.business.address || '')} · Tu tiempo, tu estilo.</span><a data-nav href="/privacidad">Privacidad y condiciones</a></footer>`; }
function openingHours() {
  const hours = state.data.business_hours || [];
  const same = hours.length === 7 && hours.every((h) => h.start_time === hours[0].start_time && h.end_time === hours[0].end_time);
  const interval = (h) => `${e(h.start_time.slice(0,5))}–${e(h.end_time.slice(0,5))}`;
  if (same) return `<strong>Todos los días</strong><span>${interval(hours[0])} · Hora del local</span>`;
  return `<strong>Horario del local</strong><span>${hours.map((h) => `${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][h.weekday]} ${interval(h)}`).join('<br>') || 'Por configurar'}</span>`;
}
function shell(content, panel = false) { return header() + (panel ? content : `<main id="main" class="shell" tabindex="-1">${content}</main>`) + footer(); }
function panel(content) {
  const links = [['agenda', 'calendar', 'Agenda'], ['ventas', 'chart', 'Ventas'], ['descansos', 'coffee', 'Descansos'], ['configuracion', 'settings', 'Configuración']].filter(([p]) => !configured || isAdmin() || ['agenda', 'descansos'].includes(p));
  return `<div class="panel-layout"><aside class="sidebar"><div class="sidebar-label">EL NEGOCIO</div>${links.map(([path, glyph, label]) => `<a href="/panel/${path}" data-nav class="${state.path.endsWith(path) ? 'active' : ''}">${icon(glyph)}${label}</a>`).join('')}</aside><main id="main" class="panel-main" tabindex="-1">${content}</main></div>`;
}
function summary() {
  const b = state.booking, s = serviceById(b.service), p = state.data.professionals.find((item) => item.id === (b.slot?.professional_id || b.professional));
  return `<aside><div class="summary-card"><div class="summary-top">${icon('calendar')}<h2>Tu próxima visita</h2></div><div class="summary-line"><span>Servicio</span><strong>${e(s?.name || 'Elige tu servicio')}</strong></div><div class="summary-line"><span>Peluquero</span><strong>${e(p?.name || 'Por seleccionar')}</strong></div><div class="summary-line"><span>Día y hora</span><strong>${b.slot ? `${e(longDate(b.date))}<br>${timeLabel(b.slot.starts_at, state.data.business.timezone)}` : 'Por seleccionar'}</strong></div><div class="summary-line"><span>Tiempo reservado</span><strong>${s ? `${s.duration_minutes} min` : '—'}</strong></div><div class="summary-total"><span class="caption">Valor del servicio</span><strong class="price">${s ? money(s.price) : '—'}</strong></div><div class="notice">Pagas en el establecimiento.<br>Efectivo, transferencia o Deuna.</div><p class="caption mt-4">Puedes cancelar hasta 30 minutos antes. Tu hora se conserva durante 5 minutos de tolerancia.</p><div class="details-strip"><div class="detail">${icon('pin')}<div><strong>Nos vemos en Zámbiza</strong><span>${e(state.data.business.address)}</span></div></div><div class="detail">${icon('clock')}<div>${openingHours()}</div></div></div></div></aside>`;
}
function bookingPage() {
  const b = state.booking;
  const steps = `<div class="steps" aria-label="Pasos de reserva">${['Tu servicio', 'Día y hora', 'Confirmación'].map((text, i) => `<span class="step ${b.step === i + 1 ? 'active' : ''}" ${b.step === i + 1 ? 'aria-current="step"' : ''}><b>${i + 1}</b>${text}</span>`).join('')}</div>`;
  let content;
  if (b.step === 1) content = `<div class="section-heading"><h2>¿Qué hacemos hoy?</h2><small>01 / ELIGE TU SERVICIO</small></div><div class="services-grid">${state.data.services.map((s, i) => `<button class="service-card ${b.service === s.id ? 'selected' : ''}" data-service="${s.id}" aria-pressed="${b.service === s.id}"><div class="service-top"><span class="service-glyph">${icon(i === 3 ? 'crown' : 'scissors')}</span><span class="selection-dot">${b.service === s.id ? icon('check') : ''}</span></div><h3>${e(s.name)}</h3><p>${e(s.description)}</p><div class="service-bottom"><span class="duration">${icon('clock')}${s.estimated_min_minutes}–${s.estimated_max_minutes} min</span><strong class="price">${money(s.price)}</strong></div></button>`).join('')}</div><div class="form-actions"><span class="caption">Un buen corte empieza con un espacio para ti.</span><button class="button" data-action="next-step" ${!b.service ? 'disabled' : ''}>Elegir día y hora ${icon('arrow')}</button></div>`;
  if (b.step === 2) content = `<div class="section-heading"><h2>Haz espacio para ti</h2><small>02 / DÍA Y HORA</small></div><form id="slots-form"><div class="form-grid">${select('¿Con quién te gustaría atenderte?', 'professional', [['', 'Cualquier peluquero disponible'], ...professionalOptions()], b.professional)}${field('Día de tu visita', 'date', 'date', b.date, `required min="${dateKey(new Date(), state.data.business.timezone)}" max="${shiftDate(dateKey(), state.data.business.horizon_days)}"`)}</div><button class="outline-button small-button" type="submit">${icon('calendar')} Consultar horarios</button></form><div class="section-heading"><h3>Horas disponibles</h3><span class="caption">Hora del local</span></div>${state.slotError ? '<div class="error-message" role="alert"><strong>No se pudo consultar el horario.</strong><p>' + e(state.slotError) + '</p><p>Pulsa Consultar horarios para volver a intentar.</p></div>' : !configured ? empty('Conecta Supabase para consultar disponibilidad real. No se generan turnos ficticios.') : !state.data.business.booking_enabled ? empty('Las reservas en línea aún no están habilitadas por el administrador.') : !state.publicConfig.ready ? empty('Falta conectar el servidor de reservas públicas. No se puede consultar disponibilidad real.') : state.slots.length ? `<div class="slots">${state.slots.map((slot, i) => `<button class="slot ${b.slot?.starts_at === slot.starts_at && b.slot?.professional_id === slot.professional_id ? 'selected' : ''}" data-slot="${i}" aria-pressed="${b.slot?.starts_at === slot.starts_at && b.slot?.professional_id === slot.professional_id}">${timeLabel(slot.starts_at, state.data.business.timezone)}</button>`).join('')}</div>` : empty('No hay horarios disponibles para esta selección. Consulta otro día o peluquero.')}<div class="form-actions"><button class="text-button" data-action="back-step">Volver a servicios</button><button class="button" data-action="next-step" ${!b.slot ? 'disabled' : ''}>Revisar mi reserva ${icon('arrow')}</button></div>`;
  if (b.step === 3) content = `<div class="section-heading"><h2>Todo listo para tu visita</h2><small>03 / TUS DATOS Y CONFIRMACIÓN</small></div><div class="surface"><h3>${e(serviceById(b.service)?.name)}</h3><p>${e(longDate(b.date))} · ${timeLabel(b.slot.starts_at, state.data.business.timezone)}</p><div class="notice">Por favor, estar 5 minutos antes de su reserva.</div><p class="caption mt-4">Cancelaciones hasta 30 minutos antes. Si no llegas dentro de los 5 minutos de tolerancia, se anula por inasistencia.</p></div><form id="booking-form"><h3 class="mb-4">Reserva sin crear una cuenta</h3>${field('Nombre completo', 'name', 'text', state.contact.name, 'required minlength="2" maxlength="100" autocomplete="name"')}${field('Número de celular', 'phone', 'tel', state.contact.phone, 'required maxlength="25" autocomplete="tel" placeholder="09XXXXXXXX o +código de país"')}${field('Correo electrónico', 'email', 'email', state.contact.email, 'required maxlength="254" autocomplete="email"')}<p class="caption">Tus datos se guardan con la cita, sin crear usuario ni contraseña. Después de confirmar podrás agregar una copia del turno a Google Calendar.</p><label class="checkbox"><input required type="checkbox" name="accept"><span>Revisé mi turno y las <a data-nav class="text-button" href="/privacidad">condiciones de reserva y privacidad</a>.</span></label><input type="hidden" name="captchaToken"><div id="booking-captcha"></div><p class="caption" role="status"></p>${!state.publicConfig.ready ? '<p class="notice">Falta conectar la reserva pública y su verificación de seguridad.</p>' : ''}<div class="form-error" role="alert"></div><button class="button full-width mt-5" type="submit" ${!state.publicConfig.ready ? 'disabled' : ''}>Confirmar reserva ${icon('check')}</button></form><button class="text-button mt-5" data-action="back-step">Cambiar día y hora</button>`;
  return `<div class="eyebrow">ESTILO CON IDENTIDAD</div><div class="hero-row"><div><h1>Tu tiempo.<br><span>Tu próximo estilo.</span></h1><p class="muted text-sm mt-4">Reserva sin crear una cuenta. Solo necesitas nombre, celular y correo.</p></div><p class="hero-note">El cuidado está en los detalles.<br>La diferencia está en El Dorado.</p></div><div class="booking-layout"><section>${steps}${content}</section>${summary()}</div>`;
}
function authPage() {
  const recover = state.authMode === 'recover', reset = state.authMode === 'reset';
  return `<div class="auth-card"><div class="eyebrow mb-6">SOLO PERSONAL DE EL DORADO</div><h1>${recover ? 'Recupera tu acceso' : reset ? 'Nueva contraseña' : 'Acceso del equipo'}</h1><p class="caption mb-6">Ingreso exclusivo del administrador y los dos peluqueros. Los clientes reservan sin cuenta.</p><form id="auth-form">${!reset ? field('Correo electrónico', 'email', 'email', '', 'required autocomplete="email"') : ''}${!recover ? field('Contraseña', 'password', 'password', '', `required minlength="8" autocomplete="${reset ? 'new-password' : 'current-password'}"`) : ''}<div class="form-error" role="alert"></div><button class="button full-width" type="submit" ${!configured ? 'disabled' : ''}>${recover ? 'Enviar enlace' : reset ? 'Guardar contraseña' : 'Ingresar'} ${icon('arrow')}</button></form>${!configured ? '<p class="notice mt-4">Primero configura Supabase. No se guardan credenciales en la vista previa.</p>' : ''}<button class="text-button mt-4" data-auth-mode="${recover ? 'login' : 'recover'}">${recover ? 'Volver a ingresar' : 'Olvidé mi contraseña'}</button><a data-nav href="/reservar" class="outline-button full-width mt-5">Soy cliente: reservar sin cuenta</a></div>`;
}
function appointmentCard(a, staff = false) {
  const canManage = staff && ['confirmed', 'checked_in', 'in_progress'].includes(a.status);
  const calendarLabel = matchMedia('(max-width: 800px)').matches ? 'Agregar al calendario' : 'Calendario';
  return `<article class="appointment"><div class="appointment-time">${timeLabel(a.starts_at, state.data.business.timezone)}<div class="caption">${timeLabel(a.ends_at, state.data.business.timezone)}</div></div><div><h3>${e(a.service_name)}</h3><div class="caption">${e(a.professional_name)}${staff ? ` · ${e(a.customer_name || 'Cliente ocasional')}` : ` · ${e(dateKey(new Date(a.starts_at), state.data.business.timezone))}`}</div>${staff && (a.customer_phone || a.customer_email) ? `<p class="caption mt-2">${e(a.customer_phone || "")} · ${e(a.customer_email || "")}</p>` : ""}<div class="mt-2"><span class="badge ${a.status}">${e(statusLabels[a.status] || a.status)}</span> <span class="caption">${a.origin === 'walk_in' ? 'Sin cita' : 'Con reserva'}${a.sale_id ? ' · Cobrado' : ''}</span></div></div><div class="appointment-actions">${canManage && a.status === 'confirmed' ? `<button class="outline-button small-button" data-appointment-action="check_in" data-id="${a.id}">Llegó</button>` : ''}${canManage && a.status === 'checked_in' ? `<button class="outline-button small-button" data-appointment-action="start" data-id="${a.id}">Iniciar corte</button>` : ''}${canManage && a.status === 'in_progress' ? `<button class="outline-button small-button" data-appointment-action="finish" data-id="${a.id}">Finalizar corte</button>` : ''}${staff && (isAdmin() || !configured) && a.visit_id && !a.sale_id && ['in_progress', 'completed'].includes(a.status) ? `<button class="button small-button" data-charge="${a.id}">Registrar cobro</button>` : ''}${mayCancel(a) ? `<button class="outline-button small-button danger" data-cancel="${a.id}">Cancelar</button>` : ''}${!staff && !['cancelled', 'no_show'].includes(a.status) ? `<button class="outline-button small-button" data-calendar="${a.id}">${icon('calendar')} ${calendarLabel}</button>` : ''}${staff && a.status === 'confirmed' ? `<button class="text-button" data-reschedule="${a.id}">Reprogramar</button>` : ''}</div></article>`;
}
function myAppointmentsPage() {
  const token = reservationToken();
  return `<div class="eyebrow">TU RESERVA, SIN CUENTA</div><div class="hero-row"><h1>Mi reserva</h1><a class="button" data-nav href="/reservar">Nueva reserva ${icon('plus')}</a></div>${state.appointments.length ? state.appointments.map((a) => appointmentCard(a)).join('') + `<div class="surface"><h2>Guarda tu enlace privado</h2><p class="caption my-4">Este enlace permite consultar y cancelar únicamente esta reserva. No lo compartas: quien lo tenga podrá gestionarla. No se envía por correo automáticamente.</p>${field('Enlace privado de esta reserva', 'private-link', 'text', location.origin + '/mi-reserva#' + token, 'readonly')}<button class="outline-button" data-action="copy-reservation">Copiar enlace privado</button></div>` : `<div class="surface"><h2>¿Ya tienes una reserva?</h2><p class="caption my-4">Pega el enlace privado que recibiste al confirmar. No buscamos citas por correo o celular, para proteger tu información. Si lo perdiste, contacta al local para verificar tu reserva.</p><form id="guest-link-form">${field('Enlace o código privado', 'token', 'password', '', 'required autocomplete="off"')}<div class="form-error" role="alert"></div><button class="button" type="submit" ${!configured ? 'disabled' : ''}>Consultar mi reserva</button></form></div>`}<div class="notice mt-6">Por favor, estar 5 minutos antes de su reserva. Puedes cancelar hasta 30 minutos antes.</div>`;
}
function agendaPage() {
  return `<div class="panel-heading"><div><div class="eyebrow mb-3">EL DÍA, BAJO CONTROL</div><h1>Agenda de citas</h1><p class="caption mt-2">${e(longDate(state.date))}</p></div><button class="button" data-action="walk-in" ${!configured ? 'disabled' : ''}>${icon('plus')} Atención sin cita</button></div><form class="toolbar" id="agenda-filter">${field('Día', 'date', 'date', state.date, 'required')}${select('Peluquero', 'professional', [['', 'Todos los autorizados'], ...professionalOptions()], state.agendaProfessional || '')}<button class="outline-button" type="submit">Consultar</button></form>${state.appointments.length ? state.appointments.map((a) => appointmentCard(a, true)).join('') : empty(configured ? 'Sin citas para este día.' : 'Aquí aparecerán las reservas reales al conectar Supabase.')}<p class="caption mt-5">Registra la llegada antes de iniciar el corte. Un cliente presente no pierde su turno mientras espera.</p>`;
}
function salesPage() {
  const data = state.dashboard || { total: 0, count: 0, average: 0, series: [], sales: [] };
  const max = Math.max(1, ...data.series.map((d) => Number(d.total)));
  return `<div class="panel-heading"><div><div class="eyebrow mb-3">CADA CORTE CUENTA</div><h1>Ventas del negocio</h1></div><button class="outline-button" data-action="retrospective" ${!configured ? 'disabled' : ''}>${icon('plus')} Registrar corte anterior</button></div><form class="toolbar" id="sales-filter">${select('Período', 'period', [['day','Día'], ['week','Semana'], ['month','Mes'], ['custom','Rango personalizado']], state.period)}${field('Desde', 'from', 'date', state.from, 'required')}${field('Hasta', 'to', 'date', state.to, 'required')}<button class="outline-button" type="submit">Ver ventas</button></form><div class="stats"><div class="stat"><p>VENTAS COBRADAS</p><strong>${money(data.total)}</strong></div><div class="stat"><p>VENTAS REGISTRADAS</p><strong>${data.count}</strong></div><div class="stat"><p>TICKET PROMEDIO</p><strong>${data.count ? money(data.average) : '—'}</strong></div></div><div class="surface"><div class="section-heading mt-0"><h2>Ventas por día</h2><span class="caption">USD · Hora del local</span></div>${data.series.length ? `<div class="chart" role="img" aria-label="Ventas diarias. Los importes se muestran en la tabla inferior.">${data.series.map((d) => `<div class="bar-col" title="${e(d.date)}: ${money(d.total)}"><div class="bar" style="height:${Math.max(2, Number(d.total) / max * 120)}px"></div><small>${e(d.date.slice(8))}</small></div>`).join('')}</div><details class="mt-5"><summary class="caption">Ver valores diarios</summary><table><thead><tr><th>Día</th><th>Ventas cobradas</th></tr></thead><tbody>${data.series.map((d) => `<tr><td>${e(d.date)}</td><td>${money(d.total)}</td></tr>`).join('')}</tbody></table></details>` : empty(configured ? 'No hay ventas en el período.' : 'Sin datos reales: conecta Supabase para consultar el dashboard.', 'chart')}</div><div class="surface"><h2 class="mb-4">Detalle de ventas</h2>${data.detail_count > data.detail_limit ? `<p class="notice mb-4">Se muestran las ${data.detail_limit} ventas más recientes de ${data.detail_count}. Los totales incluyen todo el período. Reduce el rango para revisar el detalle restante.</p>` : ''}${data.sales.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Servicios</th><th>Pago</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${data.sales.map((s) => `<tr><td>${e(dateKey(new Date(s.sold_at), state.data.business.timezone))}</td><td>${e(s.description)}</td><td>${e(paymentLabels[s.payment_method])}</td><td>${money(s.total_amount)}</td><td>${s.status === 'posted' ? 'Cobrado' : 'Anulado'}</td><td>${s.status === 'posted' ? `<button class="text-button" data-void="${s.id}">Anular</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="caption">Solo suman cobros registrados. Reservar una cita no genera una venta.</p>'}</div>`;
}
function breaksPage() {
  return `<div class="panel-heading"><div><div class="eyebrow mb-3">TIEMPO PARA UNA PAUSA</div><h1>Descansos</h1></div></div><div class="form-grid"><section class="surface"><h2 class="mb-6">Bloquear un horario</h2><form id="break-form">${staffSelect()}${field('Día', 'date', 'date', state.date, 'required')}<div class="form-grid">${field('Desde', 'start', 'time', '', 'required')}${field('Hasta', 'end', 'time', '', 'required')}</div>${field('Motivo privado', 'reason', 'text', '', 'required maxlength="200" placeholder="Almuerzo, salida, imprevisto…"')}<div class="form-error" role="alert"></div><button class="button full-width" ${!configured ? 'disabled' : ''}>Bloquear horario</button></form><p class="caption mt-4">Los clientes verán el horario no disponible, sin conocer el motivo. No se cancelan citas existentes al crear un descanso.</p></section><section><form class="toolbar" id="breaks-filter">${field('Consultar día', 'date', 'date', state.date, 'required')}<button class="outline-button">Ver</button></form>${state.breaks.length ? state.breaks.map((b) => `<article class="surface"><h3>${e(b.professional_name)}</h3><p>${timeLabel(b.starts_at, state.data.business.timezone)}–${timeLabel(b.ends_at, state.data.business.timezone)}</p><p class="caption">${e(b.reason)}</p><button class="text-button" data-remove-break="${b.id}">Retirar bloqueo</button></article>`).join('') : empty('No hay descansos registrados para este día.', 'coffee')}</section></div>`;
}
function bookingSetupSummary() {
  if (!state.settings) return '';
  const setup = state.settings.setup;
  const professionals = state.settings.professionals || [];
  const cards = setup ? professionals.map((p) => {
    const issues = professionalSetupIssues(p, setup.roles, setup.assignments);
    return `<div class="border-t border-white/10 py-4"><h3>${e(p.name)}</h3>${issues.length ? `<ul class="list-disc pl-5 mt-2">${issues.map((issue) => `<li>${e(issue)}</li>`).join('')}</ul>` : '<p class="caption mt-2">Cuenta activa, servicios y jornada guardados.</p>'}</div>`;
  }).join('') : '<p class="notice">No se pudo consultar el detalle de permisos y servicios. Recarga para volver a comprobarlo; no se ha cambiado la configuración.</p>';
  const readyCount = setup ? professionals.filter((p) => !professionalSetupIssues(p, setup.roles, setup.assignments).length).length : null;
  const hasAdmin = setup?.roles.some((role) => role.active && role.role === 'admin');
  const apiMessage = state.publicConfig.ready
    ? 'Responde y declara su configuración cargada. Falta comprobar una reserva completa para validar las claves y el CAPTCHA.'
    : state.publicConfig.status === 'unreachable'
      ? `La API no responde correctamente. Inicia npm run dev:api y comprueba que anuncia el puerto ${LOCAL_API_PORT}. Mantén también npm run dev abierto y recarga esta página. No cambies tus claves solo por este aviso.`
      : 'La API responde, pero su configuración está incompleta. Revisa SUPABASE_URL, SUPABASE_SECRET_KEY, PUBLIC_APP_ORIGIN, TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY en .env.server.local y reinicia la API. Las variables VITE_ solo configuran el ingreso del equipo.';
  return `<section class="surface" aria-label="Estado de activación"><h2>Qué falta para activar las reservas</h2><p class="caption my-4">Este resumen muestra los datos guardados. Primero guarda la jornada de cada peluquero; después marca Habilitar reservas reales y pulsa Guardar configuración.</p>${setup ? `<p class="notice">Peluqueros con configuración completa: ${readyCount} de 2.${readyCount !== 2 ? ' Se necesitan exactamente dos.' : ''}${!hasAdmin ? ' Falta una cuenta administrativa activa.' : ''}</p>` : ''}${cards}<div class="notice mt-4"><strong>Servidor de reservas:</strong> ${e(apiMessage)}</div></section>`;
}
function configurationPage() {
  const b = state.settings?.business || state.data.business;
  return `<div class="panel-heading"><div><div class="eyebrow mb-3">EL DORADO, A TU MEDIDA</div><h1>Configuración</h1></div></div>${bookingSetupSummary()}<div class="surface"><h2 class="mb-5">Reservas y políticas</h2><form id="settings-form"><div class="form-grid">${field('Nombre comercial', 'name', 'text', b.name, 'required maxlength="120"')}${field('Dirección', 'address', 'text', b.address, 'required maxlength="250"')}${field('Zona horaria IANA', 'timezone', 'text', b.timezone, 'required')}${field('Paso entre horas (minutos)', 'slot_step_minutes', 'number', b.slot_step_minutes, 'required min="5" max="60"')}${field('Anticipación mínima (minutos)', 'min_notice_minutes', 'number', b.min_notice_minutes, 'required min="0" max="10080"')}${field('Reservar hasta (días)', 'horizon_days', 'number', b.horizon_days, 'required min="1" max="180"')}</div><div class="notice">Recordatorios: 10 minutos antes · Cancelación: 30 minutos antes · Tolerancia: 5 minutos. Moneda USD y pagos directos.</div><label class="checkbox"><input type="checkbox" name="booking_enabled" ${b.booking_enabled ? 'checked' : ''}><span>Habilitar reservas reales. Confirmo servicios, nombres y jornadas de ambos peluqueros.</span></label><div class="form-error" role="alert"></div><button class="button" ${!configured ? 'disabled' : ''}>Guardar configuración</button></form></div><div class="surface"><h2>Catálogo y duración</h2><p class="caption mb-5">La duración bloqueada se inicia en el máximo del rango. Cambiar la tarifa no altera ventas históricas.</p>${state.data.services.map((s) => `<form class="service-edit border-t border-white/10 py-5" data-service-id="${s.id}"><h3 class="mb-4">${e(s.name)}</h3><div class="form-grid">${field('Precio USD', 'price', 'number', s.price, 'min="0" step="0.01" required')}${field('Tiempo reservado (min)', 'duration_minutes', 'number', s.duration_minutes, 'min="5" max="240" required')}${field('Margen posterior (min)', 'buffer_minutes', 'number', s.buffer_minutes || 0, 'min="0" max="60" required')}</div><div class="form-error" role="alert"></div><button class="outline-button small-button" ${!configured ? 'disabled' : ''}>Guardar servicio</button></form>`).join('')}</div><div class="surface"><h2>Equipo y jornadas</h2><p class="caption my-4">Crea y asigna las tres cuentas con el script de instalación antes de habilitar reservas. Cada peluquero puede gestionar sus descansos; las jornadas habituales las configura el administrador.</p>${state.settings?.professionals?.map((p) => `<form class="professional-edit border-t border-white/10 py-5" data-professional-id="${p.id}">${field('Nombre del peluquero', 'name', 'text', p.name, 'required minlength="2" maxlength="100"')}<label class="checkbox"><input name="active" type="checkbox" ${p.active ? 'checked' : ''}><span>Profesional activo</span></label><p class="caption mb-3">Días guardados: ${p.hours?.length || 0}. Marca cada día que trabaja y revisa sus horas. Escribir una hora sin marcar el día no lo habilita.</p>${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day, i) => { const h = p.hours?.find((x) => x.weekday === i); return `<div class="form-grid"><label class="checkbox"><input type="checkbox" name="day_${i}" ${h ? 'checked' : ''}><span>${day}</span></label><div class="form-grid">${field('Inicio', `start_${i}`, 'time', h?.start_time?.slice(0,5) || '09:00')}${field('Fin', `end_${i}`, 'time', h?.end_time?.slice(0,5) || '21:00')}</div></div>`; }).join('')}<div class="form-error" role="alert"></div><button class="outline-button" type="submit">Guardar jornada</button></form>`).join('') || '<p class="notice">Las cuentas y jornadas reales se configuran después de instalar la base de datos.</p>'}</div>`;
}
function privacyPage() { return `<div class="max-w-2xl mx-auto"><div class="eyebrow mb-5">INFORMACIÓN PARA TU VISITA</div><h1>Tu reserva, con claridad</h1><div class="surface mt-8"><h2>Condiciones de atención</h2><p>Por favor, estar 5 minutos antes de su reserva. Puedes cancelar hasta 30 minutos antes. Si no llegas dentro de los 5 minutos de tolerancia, el turno se anula por inasistencia.</p><p>El pago se realiza directamente en el local por efectivo, transferencia o Deuna. La aplicación no procesa pagos.</p><h2 class="mt-7">Tus datos</h2><p>Tu nombre, correo y teléfono se usan para identificar y gestionar tus citas. Solo el personal autorizado accede a la información necesaria para atenderte.</p><div class="notice">Aviso provisional: el responsable, contacto de privacidad y plazos de conservación deben completarse antes de abrir el servicio al público.</div></div><a data-nav class="outline-button" href="/reservar">Volver a reservar</a></div>`; }
async function render() {
  const version = ++renderVersion;
  state.path = location.pathname;
  try {
    let content, isPanel = state.path.startsWith('/panel');
    if (isPanel && configured && !isStaff()) { root.innerHTML = shell(`<div class="auth-card"><h1>Acceso del equipo</h1><p class="caption my-6">Ingresa con una cuenta autorizada del negocio.</p><a data-nav href="/ingresar" class="button">Ingresar</a></div>`); return; }
    if (isPanel && configured && ['ventas','configuracion'].some((x) => state.path.endsWith(x)) && !isAdmin()) { root.innerHTML = shell(empty('Esta sección está disponible solo para el administrador.', 'shield')); return; }
    if (state.path === '/' || state.path === '/reservar') content = bookingPage();
    else if (state.path === '/ingresar') content = authPage();
    else if (state.path === '/mis-citas' || state.path === '/mi-reserva') {
      const token = reservationToken();
      state.guestToken = token;
      state.appointments = token && configured ? [(await guestRequest('booking/view', { token })).appointment] : [];
      content = myAppointmentsPage();
    } else if (state.path === '/panel/agenda') {
      state.appointments = configured ? await rpc('list_appointments', { p_date: state.date, p_professional: state.agendaProfessional || null }) : [];
      content = panel(agendaPage());
    } else if (state.path === '/panel/ventas') {
      state.dashboard = configured ? await rpc('get_sales_dashboard', { p_from: state.from, p_to: state.to }) : null;
      content = panel(salesPage());
    } else if (state.path === '/panel/descansos') {
      state.breaks = configured ? await rpc('list_breaks', { p_date: state.date }) : [];
      content = panel(breaksPage());
    } else if (state.path === '/panel/configuracion') {
      state.settings = configured ? await settingsWithSetup() : null;
      state.publicConfig = configured ? await publicConfiguration() : { ready: false };
      content = panel(configurationPage());
    } else if (state.path === '/privacidad') content = privacyPage();
    else { content = empty('No encontramos esta página. Vuelve al inicio.'); isPanel = false; }
    if (version === renderVersion) { removeCaptcha(); root.innerHTML = shell(content, isPanel); if (state.publicConfig.ready) mountCaptcha(state.publicConfig.captchaSiteKey); }
  } catch (error) {
    if (version === renderVersion) root.innerHTML = shell(`<div class="error-message" role="alert">${e(friendly(error))}</div><button class="outline-button" data-action="refresh">Volver a intentar</button>`);
  }
}
function navigate(path) { history.pushState(null, '', path); state.path = path; modal.close(); render(); window.scrollTo(0, 0); }
function toast(message, title = 'El Dorado', { duration = 10000 } = {}) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<div><h3>${e(title)}</h3><p>${e(message)}</p></div><button class="icon-button" aria-label="Cerrar aviso">${icon('close')}</button>`;
  let timer;
  el.querySelector('button').onclick = () => { clearTimeout(timer); el.remove(); };
  document.querySelector('#toasts').append(el);
  if (duration > 0) timer = setTimeout(() => el.remove(), duration);
  return el;
}
function showModal(title, content) { modal.innerHTML = `<div class="modal-header"><h2 id="modal-title">${e(title)}</h2><button type="button" class="icon-button" data-close-modal aria-label="Cerrar ventana">${icon('close')}</button></div>${content}`; modal.showModal(); }
async function loadSlots() {
  state.booking.slot = null;
  state.slots = [];
  state.slotError = '';
  try {
    if (configured) {
      [state.data, state.publicConfig] = await Promise.all([bootstrap(), publicConfiguration()]);
    }
    if (!configured || !state.data.business.booking_enabled || !state.publicConfig.ready) return;
    const result = await guestRequest('slots', { serviceId: state.booking.service, date: state.booking.date, professionalId: state.booking.professional || null });
    if (!Array.isArray(result.slots)) throw new Error('PUBLIC_BOOKING_UNAVAILABLE');
    state.slots = result.slots;
  } catch (error) {
    state.slotError = friendly(error);
  }
}
function chargeModal(a) {
  showModal('Registrar cobro recibido', `<p class="caption mb-5">${e(a.customer_name || 'Cliente ocasional')} · ${e(a.service_name)}. Solo el administrador registra el pago.</p><form id="charge-form" data-visit="${a.visit_id}"><div class="field"><span>Servicios realizados</span>${state.data.services.map((s) => `<label class="checkbox"><input type="checkbox" name="service" value="${s.id}" ${s.id === a.service_id ? 'checked' : ''}><span>${e(s.name)} · ${money(s.id === a.service_id ? a.quoted_price : s.price)}</span></label>`).join('')}</div>${select('Medio de pago recibido', 'payment_method', Object.entries(paymentLabels))}<div class="notice">El servidor calcula el importe final. Confirmar registra dinero ya recibido en el local.</div><div class="form-error" role="alert"></div><button class="button full-width mt-5">Confirmar cobro recibido</button></form>`);
}
function attendanceModal(retrospective) {
  showModal(retrospective ? 'Registrar un corte ya realizado' : 'Atención sin cita', `<form id="${retrospective ? 'retrospective' : 'walk-in'}-form">${staffSelect()}${select('Servicio', 'service_id', serviceOptions())}${field('Nombre del cliente (opcional)', 'customer_name', 'text', '', 'maxlength="100" placeholder="Cliente ocasional"')}${retrospective ? field('Fecha del cobro realizado', 'sold_at', 'datetime-local', '', 'required') + select('Medio de pago recibido', 'payment_method', Object.entries(paymentLabels)) + field('Motivo del registro anterior', 'reason', 'text', '', 'required minlength="5" maxlength="200"') : '<p class="notice">Se comprobará un espacio disponible desde este momento. No se desplazan reservas.</p>'}<div class="form-error" role="alert"></div><button class="button full-width mt-5">${retrospective ? 'Registrar atención y cobro' : 'Iniciar atención'}</button></form>`);
}
document.addEventListener('click', async (event) => {
  const link = event.target.closest('a[data-nav]');
  if (link && !event.ctrlKey && !event.metaKey) { event.preventDefault(); navigate(link.getAttribute('href')); return; }
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  try {
    if (button.hasAttribute('data-close-modal')) return modal.close();
    if (button.dataset.service) { state.booking.service = button.dataset.service; state.booking.slot = null; return render(); }
    if (button.dataset.slot !== undefined) { state.booking.slot = state.slots[Number(button.dataset.slot)]; return render(); }
    if (button.dataset.authMode) { state.authMode = button.dataset.authMode; return render(); }
    if (button.dataset.action === 'next-step') { button.disabled = true; state.booking.step = Math.min(3, state.booking.step + 1); if (state.booking.step === 2) await loadSlots(); return render(); }
    if (button.dataset.action === 'back-step') { state.booking.step--; return render(); }
    if (button.dataset.action === 'refresh') { state.data = await bootstrap(); state.publicConfig = configured ? await publicConfiguration() : { ready: false }; state.me = await identity(); return render(); }
    if (button.dataset.action === 'logout') { await supabase.auth.signOut(); state.me = null; state.appointments = []; state.notifications = []; document.querySelector('#toasts').replaceChildren(); return navigate('/'); }
    if (button.dataset.action === 'walk-in') return attendanceModal(false);
    if (button.dataset.action === 'retrospective') return attendanceModal(true);
    if (button.dataset.charge) return chargeModal(state.appointments.find((a) => a.id === button.dataset.charge));
    if (button.dataset.action === 'copy-reservation') { await navigator.clipboard.writeText(`${location.origin}/mi-reserva#${state.guestToken}`); toast('Enlace privado copiado. No lo compartas con terceros.'); return; }
    if (button.dataset.cancel && !state.path.startsWith('/panel')) return showModal('Cancelar esta reserva', `<form id="guest-cancel-form">${field('Motivo (opcional)', 'reason', 'text', '', 'maxlength="200"')}<p class="notice">Se liberará tu horario. No se realiza ningún cobro.</p><div class="form-error" role="alert"></div><button class="button full-width mt-5">Confirmar cancelación</button></form>`);
    if (button.dataset.cancel) return showModal('Cancelar esta reserva', `<p class="caption mb-5">Se liberará tu horario. Esta acción no genera cobros.</p><form id="cancel-form" data-id="${button.dataset.cancel}">${field('Motivo (opcional)', 'reason', 'text', '', 'maxlength="200"')}<div class="form-error" role="alert"></div><button class="button full-width">Confirmar cancelación</button></form>`);
    if (button.dataset.reschedule) {
      const a = state.appointments.find((item) => item.id === button.dataset.reschedule);
      return showModal('Reprogramar reserva', `<p class="caption mb-5">Se validará el nuevo horario. Si está ocupado, la cita original se conserva.</p><form id="reschedule-form" data-id="${a.id}" data-revision="${a.revision}">${field('Nuevo día', 'date', 'date', dateKey(new Date(a.starts_at), state.data.business.timezone), 'required')}${field('Nueva hora local', 'time', 'time', timeLabel(a.starts_at, state.data.business.timezone), 'required')}<div class="form-error" role="alert"></div><button class="button full-width">Reprogramar</button></form>`);
    }
    if (button.dataset.appointmentAction) { button.disabled = true; await mutation('transition_appointment', { p_id: button.dataset.id, p_action: button.dataset.appointmentAction }); await render(); return; }
    if (button.dataset.removeBreak) { button.disabled = true; await mutation('remove_break', { p_id: button.dataset.removeBreak }); await render(); return; }
    if (button.dataset.void) return showModal('Anular una venta', `<p class="notice mb-5">Corrige un registro erróneo y recalcula el período original. No realiza una devolución de dinero ni elimina el historial.</p><form id="void-form" data-id="${button.dataset.void}">${field('Motivo obligatorio', 'reason', 'text', '', 'required minlength="5" maxlength="200"')}<div class="form-error" role="alert"></div><button class="button full-width">Confirmar anulación</button></form>`);
    if (button.dataset.calendar) {
      const a = state.appointments.find((item) => item.id === button.dataset.calendar);
      const calendarUrl = googleCalendarUrl(a, state.data.business);
      if (matchMedia('(max-width: 800px)').matches) { location.assign(calendarUrl); return; }
      return showModal('Tu cita en el calendario', `<a class="button full-width" href="${e(calendarUrl)}" target="_blank" rel="noopener">Agregar a Google Calendar</a><button class="outline-button full-width mt-4" data-download-ics="${button.dataset.calendar}">Descargar para otro calendario (.ics)</button><p class="caption mt-4">Se agrega una copia del turno. Si reprogramas o cancelas, actualiza también tu calendario.</p>`);
    }
    if (button.dataset.downloadIcs) {
      const a = state.appointments.find((item) => item.id === button.dataset.downloadIcs);
      const url = URL.createObjectURL(new Blob([icsEvent(a, state.data.business)], { type: 'text/calendar;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `el-dorado-${a.id}.ics`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
    }
    if (button.dataset.action === 'notifications') {
      const items = await rpc('get_notifications');
      return showModal('Recordatorios del equipo', items.length ? items.map((n) => `<div class="surface"><h3>${e(n.service_name)}</h3><p class="caption">${e(n.customer_name)} · ${timeLabel(n.starts_at, state.data.business.timezone)}</p><button class="text-button" data-read-notification="${n.id}">${n.read_at ? 'Leído' : 'Marcar como leído'}</button></div>`).join('') : empty('No hay recordatorios vigentes. Aparecen 10 minutos antes de cada cita.', 'bell'));
    }
    if (button.dataset.readNotification) { await rpc('ack_notification', { p_id: button.dataset.readNotification, p_action: 'read', p_token: null }); button.textContent = 'Leído'; }
  } catch (error) { button.disabled = false; toast(friendly(error), 'No se pudo completar'); }
});
document.addEventListener('input', (event) => {
  if (event.target.form?.id === 'booking-form' && ['name','email','phone'].includes(event.target.name)) state.contact[event.target.name] = event.target.value;
});
document.addEventListener('change', (event) => {
  if (event.target.name === 'period') {
    const form = event.target.form;
    if (event.target.value !== 'custom') { const [from, to] = periodRange(event.target.value, form.elements.from.value || dateKey()); form.elements.from.value = from; form.elements.to.value = to; }
  }
});
document.addEventListener('submit', async (event) => {
  const form = event.target; if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const f = new FormData(form), value = (name) => String(f.get(name) || '').trim();
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  const errorEl = form.querySelector('.form-error'); if (errorEl) errorEl.innerHTML = '';
  if (submit) submit.disabled = true;
  try {
    if (form.id === 'slots-form') { state.booking.date = value('date'); state.booking.professional = value('professional'); await loadSlots(); await render(); }
    else if (form.id === 'auth-form') {
      if (state.authMode === 'recover') { const { error } = await supabase.auth.resetPasswordForEmail(value('email'), { redirectTo: `${location.origin}/ingresar` }); if (error) throw error; toast('Si el correo tiene una cuenta, recibirás instrucciones para recuperar el acceso.'); }
      else if (state.authMode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password: value('password') }); if (error) throw error;
        state.me = await identity(); if (!isStaff()) { await supabase.auth.signOut(); throw new Error('NOT_AUTHORIZED'); }
        toast('Contraseña actualizada.'); state.authMode = 'login'; navigate('/panel/agenda');
      }
      else {
        await signIn(value('email'), value('password'));
        try { state.me = await identity(); if (!isStaff()) throw new Error('NOT_AUTHORIZED'); } catch (error) { await supabase.auth.signOut(); throw error; }
        navigate('/panel/agenda');
      }
    }
    else if (form.id === 'booking-form') {
      state.contact = { name: value('name'), email: value('email'), phone: value('phone') };
      const payload = { ...state.contact, serviceId: state.booking.service, professionalId: state.booking.slot.professional_id, startsAt: state.booking.slot.starts_at };
      const attempt = await guestAttempt(payload);
      await guestRequest('bookings', { ...payload, ...attempt, captchaToken: value('captchaToken') });
      clearGuestAttempt(); state.contact = { name: '', email: '', phone: '' };
      state.booking = { step: 1, date: dateKey(), service: '', professional: '', slot: null };
      // Full navigation unloads the third-party CAPTCHA script before revealing the private link.
      location.assign(`/mi-reserva#${attempt.managementToken}`);
    }
    else if (form.id === 'guest-link-form') { const token = reservationToken(value('token')); if (!token) throw new Error('RESERVATION_NOT_FOUND'); navigate(`/mi-reserva#${token}`); }
    else if (form.id === 'guest-cancel-form') { await guestRequest('booking/cancel', { token: state.guestToken, reason: value('reason') }); modal.close(); toast('Tu reserva se canceló.'); await render(); }
    else if (form.id === 'agenda-filter') { state.date = value('date'); state.agendaProfessional = value('professional'); await render(); }
    else if (form.id === 'sales-filter') { if (value('from') > value('to')) throw new Error('INVALID_INPUT'); state.from = value('from'); state.to = value('to'); state.period = value('period'); await render(); }
    else if (form.id === 'breaks-filter') { state.date = value('date'); await render(); }
    else if (form.id === 'break-form') { await mutation('create_break', { p_professional: value('professional_id'), p_date: value('date'), p_start: value('start'), p_end: value('end'), p_reason: value('reason') }); state.date = value('date'); toast('Ese horario ya no está disponible para reservar.'); await render(); }
    else if (form.id === 'cancel-form') { await mutation('cancel_booking', { p_id: form.dataset.id, p_reason: value('reason') }); modal.close(); toast('La reserva se canceló y el horario quedó libre.'); await render(); }
    else if (form.id === 'reschedule-form') { await mutation('reschedule_booking', { p_id: form.dataset.id, p_revision: Number(form.dataset.revision), p_date: value('date'), p_time: value('time') }); modal.close(); toast('Reserva reprogramada.'); await render(); }
    else if (form.id === 'charge-form') { const services = f.getAll('service').map((id) => ({ service_id: id, quantity: 1 })); if (!services.length) throw new Error('INVALID_INPUT'); const sale = await mutation('register_sale', { p_visit: form.dataset.visit, p_items: services, p_method: value('payment_method') }); modal.close(); toast(`Se registró un cobro de ${money(sale.total_amount)}.`, 'Cobro registrado'); await render(); }
    else if (form.id === 'walk-in-form') { await mutation('register_walk_in', { p_professional: value('professional_id'), p_service: value('service_id'), p_name: value('customer_name') }); modal.close(); state.date = dateKey(); await render(); }
    else if (form.id === 'retrospective-form') { await mutation('register_retrospective', { p_professional: value('professional_id'), p_service: value('service_id'), p_name: value('customer_name'), p_local_time: value('sold_at'), p_method: value('payment_method'), p_reason: value('reason') }); modal.close(); toast('Atención anterior y cobro registrados.'); await render(); }
    else if (form.id === 'void-form') { await mutation('void_sale', { p_id: form.dataset.id, p_reason: value('reason') }); modal.close(); toast('Venta anulada. Su historial se conserva.'); await render(); }
    else if (form.id === 'settings-form') { await mutation('update_settings', { p_data: { name: value('name'), address: value('address'), timezone: value('timezone'), slot_step_minutes: Number(value('slot_step_minutes')), min_notice_minutes: Number(value('min_notice_minutes')), horizon_days: Number(value('horizon_days')), booking_enabled: f.has('booking_enabled') } }); state.data = await bootstrap(); toast('Configuración guardada.'); await render(); }
    else if (form.classList.contains('service-edit')) { await mutation('update_service', { p_id: form.dataset.serviceId, p_price: Number(value('price')), p_duration: Number(value('duration_minutes')), p_buffer: Number(value('buffer_minutes')) }); state.data = await bootstrap(); toast('Servicio actualizado.'); await render(); }
    else if (form.classList.contains('professional-edit')) { const hours = Array.from({ length: 7 }, (_, i) => i).filter((i) => f.has(`day_${i}`)).map((i) => ({ weekday: i, start_time: value(`start_${i}`), end_time: value(`end_${i}`) })); await mutation('update_professional', { p_id: form.dataset.professionalId, p_name: value('name'), p_active: f.has('active'), p_hours: hours }); state.data = await bootstrap(); toast('Jornada actualizada.'); await render(); }
  } catch (error) {
    if (form.id === 'booking-form') resetCaptcha();
    const message = form.id === 'walk-in-form' && error.message?.includes('SLOT_UNAVAILABLE')
      ? 'No hay un bloque libre desde este momento para cubrir el servicio y su margen. Revisa la agenda, los descansos y la jornada del peluquero, o selecciona al otro profesional. No se inició otra atención.'
      : friendly(error);
    if (errorEl) { errorEl.innerHTML = `<p class="error-message">${e(message)}</p>`; errorEl.focus(); }
    else toast(friendly(error), 'No se pudo completar');
  } finally { if (submit?.isConnected) submit.disabled = false; }
});
async function pollNotifications() {
  if (!configured || !isStaff() || document.hidden || notificationBusy) return;
  notificationBusy = true;
  const userId = state.me.user_id;
  try {
    const items = await rpc('get_notifications');
    const validIds = new Set(items.map((n) => n.id));
    document.querySelectorAll('[data-notification-id]').forEach((el) => { if (!validIds.has(el.dataset.notificationId)) el.remove(); });
    if (state.notificationOffline) toast('La consulta de recordatorios está conectada nuevamente.');
    state.notificationOffline = false;
    for (const n of items.filter((x) => !x.presented_at)) {
      if (state.me?.user_id !== userId || document.hidden) break;
      const claim = await rpc('claim_notification', { p_id: n.id });
      if (!claim || state.me?.user_id !== userId) continue;
      const el = toast(`${n.customer_name || 'Cliente'} · ${n.service_name} · ${timeLabel(n.starts_at, state.data.business.timezone)}`, 'Tu próxima cita', { duration: 0 });
      el.dataset.notificationId = n.id;
      el.querySelector('button').onclick = () => { el.remove(); rpc('ack_notification', { p_id: n.id, p_action: 'dismiss', p_token: null }).catch(() => {}); };
      await rpc('ack_notification', { p_id: n.id, p_action: 'presented', p_token: claim });
    }
  } catch {
    document.querySelectorAll('[data-notification-id]').forEach((el) => el.remove());
    if (!state.notificationOffline && state.me?.user_id === userId) toast('No se pudieron actualizar los recordatorios. Revisa la conexión; volveremos a intentar.', 'Recordatorios sin actualizar');
    state.notificationOffline = true;
  }
  finally { notificationBusy = false; }
}
window.addEventListener('popstate', render);
window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', pollNotifications);
window.addEventListener('online', pollNotifications);
setInterval(pollNotifications, 20000);
async function start() {
  try { state.data = await bootstrap(); state.publicConfig = configured ? await publicConfiguration() : { ready: false }; state.me = await identity(); await render(); pollNotifications(); }
  catch (error) { root.innerHTML = shell(`<div class="error-message">${e(friendly(error))}</div><p class="caption">Verifica que las migraciones estén instaladas y que la URL y clave pública sean correctas.</p><button class="outline-button" data-action="refresh">Reintentar</button>`); }
}
supabase?.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { state.authMode = 'reset'; setTimeout(render, 0); }
  if (event === 'SIGNED_OUT') { state.me = null; state.notifications = []; state.appointments = []; document.querySelector('#toasts').replaceChildren(); if (state.data) setTimeout(render, 0); }
  if (event === 'SIGNED_IN' && session?.user.id !== state.me?.user_id) setTimeout(async () => {
    try { state.me = await identity(); if (state.data) await render(); pollNotifications(); }
    catch { state.me = null; }
  }, 0);
});
start();
