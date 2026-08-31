# 07 — Plan de implementación y pruebas

Estado actual: versión local implementada con pruebas; Supabase remoto y despliegue pendientes. La v0.2 cambia clientes Auth por reservas sin cuenta. Los criterios de acceso del cliente se verifican por token privado y gateway, no por sesión Auth. Ver [estado real](14-estado-de-implementacion.md) y [nuevo contrato](15-reservas-sin-cuenta.md).

## Fases y entregables

La actualización de invitados añade comprobaciones obligatorias: cero altas Auth al reservar; nombre/celular/correo exigidos; CAPTCHA validado en servidor; escritura y disponibilidad no accesibles directamente con `anon`; enlace privado de una sola reserva; rechazo de consultas por correo/UUID; idempotencia y límites; plazo de cancelación intacto. Inscripciones Auth y usuarios anónimos deben estar deshabilitados en el proyecto real.

| Fase | Trabajo | Condición de cierre |
| --- | --- | --- |
| 0. Definición | Incorporados nombre/dirección/USD, precios y rangos por servicio, horario, equipo, pagos presenciales, cancelación/tolerancia, destinatarios, descansos y Google Calendar | Completar detalles de configuración y responsables; fase aún no cerrada. |
| 1. Base visual | Crear proyecto HTML/Tailwind/JS, Vite propuesto, navegación y componentes | Build reproducible y pantallas responsive con muestras identificadas. |
| 2. Datos y acceso | Migraciones, autenticación, roles, catálogo, horarios y RLS | Esquema reproducible y pruebas de acceso de cliente/peluquero/admin. |
| 3. Agenda | Disponibilidad, reserva, descansos, llegada, vencimiento automático, cancelación y reprogramación | Sin cruces ni cambios ajenos; se respeta 30 minutos de cancelación y 5 de tolerancia. |
| 4. Atención y venta | Con cita, walk-in, retrospectivos, precios históricos y cobros | Una venta por atención; total persistente, trazable y correcto. |
| 5. Dashboard | Filtros, totales, series y detalle | Coincidencia de cálculos con conjunto de prueba conocido. |
| 6. Recordatorios | Persistencia, vigencia, flotantes, bandeja y sincronización | Prueba de visualización con web abierta, reconexión, invalidación y aislamiento de cuentas. |
| 6B. Google Calendar | OAuth opcional, secretos, cola de sincronización y procesador | Evento único de cita propia, cambios/cancelaciones propagados y reserva independiente de fallos Google. |
| 7. Publicación | Repositorio, entornos, hosting, respaldo y formación | Verificaciones de producción y aceptación del dueño. |

La fase 1 puede avanzar mientras se resuelven datos de negocio. No cerrar fases que dependen de decisiones no tomadas. Crear estructura futura sin publicar ni habilitar reservas reales por defecto.

## Criterios de aceptación

| ID | Relación | Escenario y resultado esperado |
| --- | --- | --- |
| CA01 | RF01–RF04 | Con configuración incompleta no se puede confirmar una reserva pública. |
| CA02 | RF02–RF03 | Descansos, cierres por fecha y horario de profesional reducen correctamente las horas ofrecidas. |
| CA03 | RF03 | Un servicio que no cabe completo, incluido margen, no aparece como disponible. |
| CA04 | RF03–RF04 | Dos solicitudes simultáneas por el mismo profesional e intervalo producen una sola reserva válida. |
| CA05 | RF03 | Intervalos consecutivos sin cruce son válidos; intervalos solapados de distinta duración se rechazan. |
| CA06 | RF03–RF05 | Dos profesionales disponibles pueden atender a la misma hora; cada uno mantiene capacidad uno. |
| CA07 | RF04–RF05 | Reprogramación fallida conserva la hora original y sus recordatorios vigentes. |
| CA08 | RF05–RF06 | Cancelación permitida libera la hora e invalida notificaciones de cita próxima, conservando historial. |
| CA09 | RF05 | Un cambio de horario concurrente con una reserva no deja una cita fuera de jornada; se rechaza una de las operaciones. |
| CA10 | RF07–RF09 | Doble clic o reintento tras pérdida de respuesta no duplica atención ni venta. |
| CA11 | RF08 | Un walk-in ocupa agenda inmediatamente y no invade una cita; aparece en ventas al cobrar. |
| CA12 | RF08 | Un registro retrospectivo conserva fecha real y fecha de registro, exige permiso y no bloquea horas actuales. |
| CA13 | RF09 | Cambiar el catálogo después del cobro no cambia ventas históricas. La cotización de una cita sigue la política aprobada. |
| CA14 | RF09 | Precio/total manipulado desde el navegador no altera el cálculo autorizado del servidor. |
| CA15 | RF10 | Día, semana, mes y rango utilizan la zona del negocio y límites inclusivos en la interfaz. |
| CA16 | RF10 | Citas sin cobro y ventas anuladas no suman; walk-ins sí; tarjetas, tabla y gráfico coinciden. |
| CA17 | RF10 | Período vacío muestra ceros y “Sin ventas”; fallo de red muestra error, no ceros engañosos. |
| CA18 | RF12 | Cliente A no puede consultar/cambiar citas o contactos de B aun con su UUID. |
| CA19 | RF11–RF12 | Cliente y peluquero sin permiso no acceden a dashboard, roles ni anulaciones de ventas llamando directamente a la API. |
| CA20 | RF12 | Solicitudes anónimas no exponen contactos, citas nominales, ventas ni datos privados mediante tablas, vistas o RPC. |
| CA21 | RF06 | Con web abierta el aviso vigente se muestra; cerrada no hay aviso externo. Al volver se recuperan solo avisos aún vigentes. |
| CA22 | RF06 | Reprogramación/cancelación invalida avisos anteriores; una cita pasada no se muestra como próxima al reconectar. |
| CA23 | RF06 | Dos pestañas no reclaman simultáneamente el mismo aviso; una concesión vencida se recupera con revalidación. Confirmar renderizado no marca lectura humana. |
| CA24 | Interfaz | Reserva y cobro son utilizables en móvil y teclado, con errores, estados vacíos y foco visible. |
| CA25 | Despliegue | Enlaces directos, recargas, login y callback funcionan en dominio de producción; no hay secretos en el build. |
| CA26 | RF02–RF03 | Con bloques propuestos y margen cero: normal termina a las 21:00 si comienza 20:15; diseño/barba desde 20:10; completo desde 20:00. Un minuto después no cabe. La cuadrícula puede ofrecer solo horas anteriores. |
| CA27 | RF03–RF05 | Con dos peluqueros libres hay como máximo dos atenciones simultáneas según recursos; la cuenta administrativa no agrega un tercer cupo. |
| CA28 | RF06–RF12 | Un usuario no lee, reclama ni reconoce avisos ajenos por API o Realtime. Cerrar sesión limpia los flotantes antes de ingresar con otra cuenta. |
| CA29 | RF06 | Cerrar flotante conserva bandeja; leer requiere acción explícita. Recargar no repite avisos reconocidos. Alcanzar `visible_from` se detecta aunque no llegue evento Realtime. |
| CA30 | RF15 | Cita a las 15:00: cancelar a las 14:30 permitido, a las 14:30:01 rechazado. Manipular reloj del navegador no cambia el resultado. |
| CA31 | RF15 | Llegada hasta 15:05 incluida evita anulación; a 15:05:01 sin llegada, la cita vence. No se aceptan fechas de llegada inventadas por el cliente. |
| CA32 | RF15 | Cliente llegado a tiempo y esperando al peluquero no pasa a `no_show`; ausencia libera cupo y no genera venta. |
| CA33 | RF03–RF15 | Llegada, proceso de vencimiento y reserva competidora se serializan; nunca se conserva una llegada válida y una nueva reserva cruzada. Funciona con navegadores cerrados. |
| CA34 | RF14–RF12 | Peluquero bloquea solo su agenda y administrador cualquiera; bloqueo contra una cita se rechaza, incluso concurrentemente. Público no ve motivo. |
| CA35 | RF09 | Venta USD registra efectivo, transferencia o Deuna manualmente, sin llamar a pasarelas ni convertir una reserva en pago. |
| CA36 | RF16 | Recomendación de llegar 5 minutos antes aparece en resumen/confirmación y evento conectado, sin adelantar el inicio ni alterar tolerancia. |
| CA37 | RF13 | Con consentimiento, una cita propia crea un evento; rechazar OAuth o caída de Google no deshace ni bloquea la reserva. |
| CA38 | RF13 | Reintento no duplica evento; reprogramar actualiza el mismo, cancelar/inasistencia lo retira. Un trabajo antiguo no sobrescribe la versión nueva. |
| CA39 | RF13–RF12 | A no usa conexiones/citas de B; no hay tokens en frontend/logs. Revocar acceso detiene reintentos inútiles; borrar en Google no cancela el turno. |
| CA40 | RF06 | Avisos solo al personal autorizado: propuesta de peluquero asignado + administrador; cliente y otro peluquero no reciben datos de esa cita. |

## Conjunto mínimo para comprobar ventas

Datos ficticios; no son la lista de precios del negocio. Usar moneda de prueba con dos decimales. Días definidos en la zona horaria configurada.

| Registro | Fecha de cobro / referencia | Estado | Importe |
| --- | --- | --- | --- |
| Venta con cita | 2026-08-24, 10:00 | `posted` | 10.00 |
| Venta sin cita | 2026-08-24, 18:00 | `posted` | 15.00 |
| Registro equivocado anulado | 2026-08-24, 18:30 | `voided` | 8.00 |
| Venta con cita | 2026-08-25, 11:00 | `posted` | 20.00 |
| Venta retrospectiva cargada el 27 | 2026-08-25, 16:00 | `posted` | 5.00 |
| Cita futura sin cobro | Cita el 2026-08-26 | Sin venta | No aplica |
| Venta en siguiente mes | 2026-09-01, 00:00 | `posted` | 7.00 |

Resultados esperados: día 24 = 25.00 y 2 ventas; día 25 = 25.00 y 2 ventas; rango 24–25 = 50.00 y 4 ventas, ticket promedio 12.50. Semana del 24 al 30 y mes de agosto = 50.00. Día 26 = 0.00; septiembre = 7.00. Agregar pruebas de límites justo antes/después de medianoche y de un rango que cruce mes/año.

## Estrategia de verificación

- Pruebas de base de datos para permisos, no superposición, unicidad y transacciones monetarias.
- Pruebas de integración para disponibilidad, descansos/llegada/vencimiento concurrentes, idempotencia, notificaciones internas y sincronización Google con proveedor simulado.
- Pruebas de flujo completo para reserva, atención, venta y avisos con identidades de prueba y reloj controlado.
- Revisión visual y manual en móvil, tableta y escritorio, con sesión vencida y red interrumpida.
- Verificar restauración en un ambiente separado y una prueba controlada de recordatorio antes de producción.

No basta con probar mensajes de error de la interfaz: intentar las operaciones no autorizadas directamente contra la API con las identidades de prueba. No usar cuentas ni clientes reales para datos ficticios.

## Lista de salida a producción

- [ ] Decisiones necesarias cerradas y reflejadas en la configuración.
- [ ] Catálogo y horarios del dueño revisados; sin datos de muestra.
- [ ] Cuenta administradora creada de forma segura y acceso de prueba retirado.
- [ ] CA01–CA40 ejecutados, con evidencia y fallos críticos resueltos.
- [ ] Anticipación de flotantes configurada para peluqueros y administrador; probadas reconexión y privacidad de bandejas.
- [ ] Tarea de inasistencias y normalización antes de disponibilidad verificadas sin depender de la web abierta.
- [ ] Google OAuth configurado y probado con cuentas de prueba; creación/cambio/cancelación sin duplicados y secretos protegidos. No dar una descarga `.ics` por sincronización terminada.
- [ ] Dashboard contrastado con registros reales de prueba controlada.
- [ ] Aviso de privacidad, contacto y políticas visibles según lo acordado.
- [ ] Repositorio sin secretos, entornos separados y respaldo/restauración verificados.
- [ ] Alojamiento con plan adecuado al uso y límites de consumo revisados.
- [ ] Dueño conoce cómo reservar, atender, cobrar, corregir y consultar reportes.
- [ ] Publicación y activación de reservas reales confirmadas para la fecha acordada.

La lista está pendiente: documentar una prueba no significa que se haya ejecutado.
