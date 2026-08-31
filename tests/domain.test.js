import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, periodRange, mayCancel, escapeHtml, icsEvent } from '../src/lib/domain.js';

test('Reportes usan el día de Quito incluso al cruzar medianoche UTC', () => {
  assert.equal(dateKey(new Date('2026-09-01T03:00:00Z')), '2026-08-31');
  assert.equal(dateKey(new Date('2026-09-01T05:00:00Z')), '2026-09-01');
});
test('Semana lunes-domingo y mes respetan cambios de año y febrero bisiesto', () => {
  assert.deepEqual(periodRange('week', '2027-01-01'), ['2026-12-28', '2027-01-03']);
  assert.deepEqual(periodRange('week', '2026-08-30'), ['2026-08-24', '2026-08-30']);
  assert.deepEqual(periodRange('month', '2028-02-20'), ['2028-02-01', '2028-02-29']);
});
test('Cancelación incluye el instante límite y excluye citas presentes/canceladas', () => {
  const a = { status: 'confirmed', cancellation_deadline: '2026-09-01T15:30:00Z' };
  const limit = Date.parse(a.cancellation_deadline);
  assert.equal(mayCancel(a, limit), true);
  assert.equal(mayCancel(a, limit + 1), false);
  assert.equal(mayCancel({ ...a, status: 'checked_in' }, limit - 100), false);
});
test('Nombres y texto no inyectan HTML', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> & \' '), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39; ');
});
test('ICS conserva UTC, escapa campos y pliega Unicode sin crear propiedades nuevas', () => {
  const ics = icsEvent({ id: 'abc', starts_at: '2026-09-01T10:00:00-05:00', ends_at: '2026-09-01T10:45:00-05:00', service_name: 'Corte, especial; á'.repeat(15) }, { name: 'El Dorado', address: 'Quito\r\nBEGIN:VEVENT' });
  assert.match(ics, /DTSTART:20260901T150000Z/);
  assert.match(ics, /DTEND:20260901T154500Z/);
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2); // One is escaped address text.
  assert.equal(ics.split('\r\nBEGIN:VEVENT\r\n').length - 1, 1);
  assert.match(ics.replace(/\r\n /g, ''), /LOCATION:Quito\\nBEGIN:VEVENT/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.ok(!ics.includes('\uFFFD'));
});
