# 06 — Recordatorios como notificaciones flotantes

Actualización: 31 de agosto de 2026. **Canal confirmado por el usuario: dentro del aplicativo web, mediante una notificación flotante.** Sustituye la propuesta anterior de mensajería externa. La primera implementación SQL y web ya existe; la conexión y prueba con Supabase real están pendientes.

## Alcance y límites

- La notificación es un componente de la página, también llamado toast; se muestra con la web abierta y sesión autorizada.
- Con la página cerrada no habrá aviso en el teléfono o escritorio. Tampoco se promete visualización puntual en una pestaña suspendida o sin conexión.
- Propuesta: conservar avisos en Supabase y una bandeja en la interfaz para no depender de un elemento que desaparece.
- Al iniciar sesión, reconectar o volver a la pestaña, recuperar los avisos que aún correspondan; no presentar como próxima una cita que ya pasó.
- No solicitar permiso de notificaciones del sistema para un toast. Web Push, correo, SMS y WhatsApp quedan fuera del MVP de recordatorios.

**Destinatarios confirmados:** los peluqueros y el administrador. Propuesta de distribución con mínimo acceso: una notificación para el peluquero asignado a la cita y otra para el administrador; no avisar al otro peluquero por defecto. Se requieren cuentas individuales vinculadas al equipo. **Anticipación confirmada: 10 minutos antes.** El cliente no recibe estos flotantes; su conexión opcional a Google Calendar se describe [por separado](12-google-calendar.md).

## Diseño propuesto sin proveedor externo

1. Al reservar, el servidor crea filas `notifications` para los destinatarios autorizados, junto con la cita y su ocupación, en una transacción.
2. Cada fila guarda versión de agenda, `visible_from` y `expires_at`. La anticipación aprobada determina el inicio de vigencia; el reloj del servidor es la referencia.
3. La web consulta mediante una operación autenticada los avisos vigentes de su usuario al cargar, volver al primer plano y reconectar. Implementación inicial: consulta adicional cada 20 segundos mientras la página está visible; ese intervalo no es la anticipación del recordatorio.
4. Supabase Realtime puede acelerar la detección de altas y cambios, con autorización; no sustituye la consulta al llegar una hora programada, porque el paso del tiempo no genera un cambio en la fila.
5. La web reclama temporalmente un aviso, revalida su vigencia y lo muestra. Confirma su presentación solo después de renderizarlo.
6. La bandeja permite abrir la cita, marcar el aviso leído o cerrar el flotante. Cerrar no equivale a leer ni a cancelar la cita.

El soporte de escucha de cambios está documentado en [Supabase Realtime](https://supabase.com/docs/guides/realtime/postgres-changes). Los flotantes no necesitan Cron ni una Edge Function de envío: el servidor guarda programación y las consultas determinan vigencia. Sí habrá tareas de servidor independientes para anular inasistencias y sincronizar Google. No basta con un temporizador local ni con `localStorage` como único registro.

## Persistencia, lectura y duplicados

- Unicidad por destinatario + cita + versión de agenda + tipo de aviso + anticipación. Un reintento de reserva no genera avisos adicionales.
- `status`: `active` o `invalidated`; la vigencia temporal se deriva de `visible_from` y `expires_at`, sin necesitar un proceso que cambie estados por reloj.
- `first_presented_at`: primera confirmación de renderizado; no prueba lectura humana. `read_at`: acción explícita de lectura. `dismissed_at`: cierre del flotante, sin borrar la bandeja.
- Si hay varias pestañas o dispositivos, la reclamación usa una concesión temporal en servidor y token de reclamación. Solo una obtiene la presentación en ese momento; tras un fallo puede recuperarse cuando vence la concesión.
- Una caída entre renderizar y confirmar puede causar repetición tras recuperar la concesión. No prometer presentación exactamente una vez; la prioridad es conservar el aviso y minimizar duplicados.
- Un aviso ya presentado no vuelve a abrirse en cada consulta; continúa en la bandeja hasta leerse o expirar según la política acordada.
- Al cerrar sesión, vaciar notificaciones de memoria y cerrar suscripciones. Al cambiar de cuenta, no mostrar avisos de la sesión anterior.

## Cambios en las citas

Reprogramar invalida filas de la versión anterior y crea las nuevas atómicamente. Cancelar, marcar ausencia o completar invalida avisos de cita próxima. El cliente vuelve a consultar al recibir un cambio o recuperar conexión; una tarjeta ya abierta debe actualizarse o cerrarse si dejó de ser válida. Al abrir su enlace se comprueban otra vez permisos y estado.

Propuesta para reservas de última hora: `visible_from = max(instante_de_reserva, inicio_de_cita - anticipación)` y `expires_at = inicio_de_cita`. Así se puede avisar de inmediato si la cita aún es futura. No crear avisos próximos para walk-ins ni registros retrospectivos. La anticipación confirmada es de 10 minutos. Mostrar avisos de llegada/ausencia sería otro tipo de notificación, aún no solicitado como flotante automático.

Los avisos de confirmación, cancelación o cambios son tipos diferentes del recordatorio previo y permanecen pendientes de alcance; no convertir un aviso vencido de cita próxima en otro tipo automáticamente.

Cambiar el peluquero asignado o la anticipación requiere una operación autorizada: invalidar avisos futuros afectados y regenerarlos para asignado + administrador. Las consultas verifican permisos actuales incluso si una cuenta perdió acceso. Conservar constancia de avisos ya presentados sin volver a mostrarlos como nuevos por una edición. La asignación del turno debe pasar además por la validación de disponibilidad correspondiente.

## Interfaz propuesta

- Confirmado el 31 de agosto: los avisos de operaciones como «Servicio actualizado», «Jornada actualizada» y «Configuración guardada» se cierran automáticamente a los **10 segundos**, conservando el botón de cierre. Esto no elimina registros en Supabase ni cambia los recordatorios de cita: estos mantienen su cierre manual y vigencia ligada al inicio de la reserva.
- Flotante oscuro con título dorado, texto blanco, botón “Ver cita” y cierre accesible.
- Ejemplo: “Cita próxima en El Dorado · {fecha} a las {hora} · {servicio}”. Incluir nombre del cliente solo si el destinatario tiene permiso y lo necesita.
- Bandeja con contador de no leídos y estados de vigencia claros; ninguna notificación bloquea el formulario de reserva o de cobro.
- Región accesible `aria-live="polite"`; sin robo de foco y sin sonido obligatorio. Duración visual configurable y contenido disponible después en la bandeja.
- Mensaje de estado si se pierde conexión: no afirmar que la bandeja está al día hasta sincronizar.

## Seguridad y pruebas

RLS y funciones deben comprobar el destinatario contra la sesión y el acceso vigente a la cita. Los usuarios solo pueden reconocer su presentación/lectura/cierre; no cambiar destinatario, texto, fecha programada ni crear avisos arbitrarios. El filtro de una suscripción no reemplaza los permisos.

Verificar: aviso visible a tiempo con la web abierta, ausencia de avisos externos al cerrarla, recuperación de avisos aún futuros, descarte de vencidos, invalidación por cambios, aislamiento de cuentas, reclamación entre dos pestañas y persistencia tras recargar. Registrar errores de consulta sin contactos ni tokens. La referencia de pruebas es [CA21–CA23 y CA26–CA29](07-implementacion-y-pruebas.md).
