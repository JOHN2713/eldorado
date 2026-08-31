# 12 — Google Calendar del cliente

Estado: requisito solicitado el 31 de agosto de 2026; diseño propuesto, todavía no implementado. No se ha conectado ninguna cuenta ni creado eventos. La versión local 0.1.0 incluye únicamente una descarga `.ics` con advertencia explícita; no sustituye esta integración.

## Objetivo y viabilidad

Permitir que, después de confirmar su turno, el cliente lo sincronice voluntariamente con su Google Calendar. Google documenta creación de eventos mediante API y autorización del usuario: [crear eventos](https://developers.google.com/workspace/calendar/api/guides/create-events).

Propuesta para cumplir el requisito: **sincronización en un sentido, aplicativo → Google**, con alta del evento, actualización al reprogramar y eliminación del evento creado por la app al cancelar o anular por inasistencia. La disponibilidad y la reserva oficial siempre están en Supabase. Cambiar o borrar un evento en Google no cancela ni reprograma la cita del negocio.

No es obligatorio tener Google para reservar. Tampoco es necesario iniciar sesión en la aplicación mediante Google: la conexión al calendario es una autorización adicional y opcional.

## Flujo del cliente

1. Confirma la cita en la aplicación y obtiene su referencia válida.
2. Lee ubicación, horario, precio, política de cancelación y “Por favor, estar 5 minutos antes de su reserva.”
3. Pulsa “Conectar Google Calendar y sincronizar esta cita”. Si no está conectado, autoriza su propia cuenta Google mediante OAuth.
4. El servidor valida el token privado de esa reserva, crea un estado OAuth de un solo uso ligado a la cita y, tras el consentimiento de la cuenta Google, guarda la conexión de forma segura. No se crea cuenta Supabase para el cliente ni se confía en el correo escrito como prueba de titularidad.
5. La interfaz muestra “Pendiente de sincronizar”, “Sincronizada” o un error recuperable. Solo marca éxito tras confirmar la respuesta de Google.
6. Reprogramaciones o anulaciones posteriores actualizan ese mismo evento mientras exista autorización. Desconectar detiene futuras sincronizaciones y avisa de que las copias existentes ya no se actualizarán.

Propuesta adaptada a clientes sin cuenta: conexión Google vinculada a una reserva y sincronización por elección explícita. No activar automáticamente todas sus reservas futuras. No elegir ni escribir sobre el calendario de otra persona.

## Contenido del evento

| Campo | Valor propuesto |
| --- | --- |
| Título | El Dorado Barbería — nombre del servicio |
| Inicio | Hora real de la reserva, sin restar los 5 minutos de llegada recomendada |
| Fin | Inicio + bloque reservado del servicio; no incluir margen interno de limpieza |
| Lugar | Zámbiza, calle Quito; completar referencia cuando se aporte |
| Descripción | Referencia no secreta, servicio, enlace genérico a la web, recomendación de llegada y política de cancelación; nunca el token privado |
| Zona horaria | Zona configurada del negocio, convertida correctamente a la cuenta del cliente |

No enviar contactos de terceros, notas privadas, datos de ventas, secretos ni tokens de acceso en el evento o su URL. No agregar peluqueros/administrador como invitados ni enviar correos de invitación por defecto. Los recordatorios personales que use Google dependen de la configuración del calendario del cliente; no se promete una notificación del sistema desde nuestra web.

## Autorización y seguridad

Configurar un proyecto Google Cloud, Calendar API, cliente OAuth web, pantalla de consentimiento y callbacks HTTPS. Solicitar el alcance mínimo compatible con el calendario elegido; definirlo y revisar requisitos de publicación/verificación antes de producción. Algunos permisos pueden dar un alcance mayor que los eventos de la peluquería: no prometer una restricción por evento que Google no imponga. La aplicación debe limitar sus operaciones a los IDs que ella creó. Fuentes: [consentimiento y permisos](https://developers.google.com/workspace/guides/configure-oauth-consent) y [OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).

El servidor valida `state` de un solo uso, sesión OAuth temporal (cookie segura, sin alta Auth), origen de retorno y vínculo con la reserva y cuenta Google correctas; utiliza PKCE cuando corresponda al flujo elegido. Guardar refresh tokens cifrados en almacenamiento privado del servidor, nunca en tablas expuestas, `localStorage`, variables `VITE_`, URLs o logs. Los tokens de acceso deben permanecer en el servidor para esta integración.

La denegación o revocación de Google no invalida citas. Ante credenciales revocadas, detener reintentos que no pueden tener éxito, mostrar “Reconectar Google” al cliente y mantener la reserva operativa. El administrador no necesita ni puede ver los tokens del cliente.

## Persistencia y trabajo en segundo plano

Tablas propuestas en esquema privado: `calendar_connections` (reserva, identidad Google obtenida de OAuth, calendario destino, secretos cifrados, estado) y `calendar_sync_jobs` (vínculo, versión objetivo, intentos, próxima ejecución, concesión, error sanitizado). `appointment_calendar_links` relaciona cita/cliente/conexión con el ID externo, la última revisión sincronizada y su estado público reducido.

Los cambios de cita y el trabajo pendiente se guardan en una transacción PostgreSQL. Un procesador en servidor ejecuta después la llamada Google; no mantener una transacción SQL abierta esperando la red. Puede activarse con Supabase Cron y una Edge Function. Esta automatización es distinta de los flotantes, que siguen sin requerir un proceso de envío.

- Identificador de evento estable, válido para Google, y unicidad por cita/conexión para evitar duplicados al reintentar una creación incierta.
- Procesar un vínculo a la vez, releer el estado más reciente de la cita y guardar revisión sincronizada. Nunca permitir que un reintento viejo sobrescriba una reprogramación nueva.
- Si la cita cambia mientras Google está respondiendo, conservar trabajo pendiente para reconciliar el estado final; si se creó un evento de una cita ya cancelada, eliminar solo ese evento como compensación.
- Reintentos limitados con espera creciente para fallos temporales; distinguir revocación, límite temporal y recurso inexistente.
- Si el cliente eliminó el evento en Google, no recrearlo repetidamente sin advertencia: mostrar la desvinculación y permitir restauración explícita. No interpretar ese borrado como cancelación de la reserva.
- Desconectar revoca/elimina credenciales según corresponda y detiene trabajos. Explicar que la copia externa puede permanecer y requerir eliminación manual; no prometer borrarla si ya no hay permiso.

Google ofrece operaciones de [actualización](https://developers.google.com/workspace/calendar/api/v3/reference/events/update) y [eliminación](https://developers.google.com/workspace/calendar/api/v3/reference/events/delete). Los fallos o retrasos de esas operaciones se muestran como estado de sincronización; no revierten una cancelación o reserva válida en Supabase.

## Alternativa limitada si OAuth no está listo

Se puede ofrecer una exportación `.ics` para importar el turno, identificándola como **“Descargar evento”**, no “Sincronización automática”. Una importación no mantiene los cambios posteriores; Google distingue importar de sincronizar en su [ayuda de importación](https://support.google.com/calendar/answer/37118?hl=en-GB). Validar importación en los dispositivos objetivo y evitar prometer que el teléfono importará el archivo de la misma manera que la web.

Esta alternativa no da por terminada la sincronización solicitada. No sustituirla silenciosamente por un enlace o descarga; mantener la integración OAuth como trabajo pendiente hasta implementarla y verificarla.

## Entregables y aceptación

- Conectar y desconectar una cuenta propia, con consentimiento y secretos protegidos.
- Crear un único evento de una reserva confirmada; actualizarlo al reprogramar y retirarlo al cancelar o anular.
- Rechazo de conexión o caída de Google no bloquea la reserva.
- Horas correctas aunque el teléfono esté en otra zona horaria; llegada recomendada no cambia el inicio.
- Probar reintentos, cambios concurrentes, eventos borrados externamente y revocación de permisos.
- Cliente A no sincroniza citas ni usa conexiones de B; peluqueros/admin no acceden a tokens.

Configuración pendiente: responsable de Google Cloud, dominio/callbacks, política de privacidad y selección del calendario destino/alcance mínimo. El calendario personal del cliente no se leerá para calcular cupos de la peluquería ni se sincronizarán eventos ajenos a la app.
