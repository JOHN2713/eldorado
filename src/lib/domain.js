export const money = (value) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
export const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const statusLabels = { confirmed: 'Reservada', checked_in: 'Cliente presente', in_progress: 'En atención', completed: 'Finalizada', cancelled: 'Cancelada', no_show: 'Anulada · inasistencia' };
export const paymentLabels = { cash: 'Efectivo', bank_transfer: 'Transferencia', deuna: 'Deuna' };
export const dateKey = (instant = new Date(), zone = 'America/Guayaquil') => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
export const timeLabel = (instant, zone = 'America/Guayaquil') => new Intl.DateTimeFormat('es-EC', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(instant));
export const longDate = (date) => new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`));
export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function periodRange(period, date = dateKey()) {
  const d = new Date(`${date}T12:00:00Z`);
  if (period === 'week') {
    const start = shiftDate(date, -((d.getUTCDay() + 6) % 7));
    return [start, shiftDate(start, 6)];
  }
  if (period === 'month') {
    return [`${date.slice(0, 7)}-01`, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10)];
  }
  return [date, date];
}
export const mayCancel = (appointment, now = Date.now()) => appointment.status === 'confirmed' && now <= new Date(appointment.cancellation_deadline).getTime();
const calendarStamp = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function googleCalendarUrl(appointment, business) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    dates: `${calendarStamp(appointment.starts_at)}/${calendarStamp(appointment.ends_at)}`,
    stz: business.timezone,
    etz: business.timezone,
    text: `${business.name} — ${appointment.service_name}`,
    location: business.address,
    details: 'Por favor, estar 5 minutos antes de su reserva. Puedes cancelar hasta 30 minutos antes desde la aplicación. Este evento es una copia y no se actualiza automáticamente.',
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params}`;
}
export function icsEvent(appointment, business) {
  const clean = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//El Dorado//Agenda//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${appointment.id}@eldorado.local`, `DTSTAMP:${calendarStamp(new Date())}`, `DTSTART:${calendarStamp(appointment.starts_at)}`, `DTEND:${calendarStamp(appointment.ends_at)}`, `SUMMARY:${clean(`${business.name} — ${appointment.service_name}`)}`, `LOCATION:${clean(business.address)}`, `DESCRIPTION:${clean('Por favor, estar 5 minutos antes de su reserva. Puedes cancelar hasta 30 minutos antes desde la aplicación. Esta copia no se actualiza automáticamente.')}`, 'END:VEVENT', 'END:VCALENDAR'];
  // RFC 5545: fold by UTF-8 octets without splitting a code point.
  return lines.map((line) => {
    let part = '', out = '', bytes = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 74) { out += `${part}\r\n `; part = ''; bytes = 1; }
      part += char; bytes += size;
    }
    return out + part;
  }).join('\r\n') + '\r\n';
}
