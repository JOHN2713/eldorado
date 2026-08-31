# 02 — Flujos y reglas del negocio

Las reglas marcadas como propuestas se revisarán con el usuario. Fuente de decisiones: [registro D01–D16](10-decisiones-y-pendientes.md).

## 1. Configuración inicial

Datos vigentes de El Dorado Barbería: apertura de lunes a domingo 09:00–21:00, dos peluqueros y administrador; dirección Zámbiza, calle Quito; USD. Rangos confirmados: normal 30–45, diseño 40–50, con barba 40–50 y completo 50–60 minutos. Propuesta de reserva: usar respectivamente 45, 50, 50 y 60 minutos; no usar el mínimo para ofrecer cupos. Márgenes y cuadrícula siguen configurables. Ver [ficha del negocio](11-ficha-del-negocio.md).

El administrador registra los datos del local, moneda, zona horaria, servicios y duración, profesionales y disponibilidad. Los horarios pueden tener varios intervalos diarios para representar descansos. Las excepciones por fecha sustituyen la jornada habitual de ese día, incluso con una lista vacía para indicar cierre.

No activar reservas reales si falta configuración obligatoria. Desactivar un servicio no elimina sus citas futuras: el administrador debe revisarlas. Modificar una duración o un precio afecta nuevas operaciones; no reescribe reservas ni ventas existentes.

## 2. Reserva del cliente

1. El cliente elige un servicio activo y, si se habilita, un profesional.
2. Consulta un día del calendario. Solo se muestran horas disponibles y la zona horaria del local.
3. Completa nombre, número de celular y correo obligatorios, sin crear cuenta ni contraseña. Se valida formato y CAPTCHA; estos contactos no son una identidad verificada.
4. Revisa fecha, hora, duración, servicio, precio de referencia y política aplicable.
5. Al confirmar, el servidor vuelve a comprobar horario, servicio, profesional, permisos y ausencia de cruces.
6. La transacción guarda la cita, su ocupación del calendario y las notificaciones internas programadas para los destinatarios configurados.
7. Solo tras la respuesta satisfactoria se presenta la confirmación y el enlace privado de esa reserva. Conservarlo para consultar/cancelar. Nunca buscar historial solo por correo o celular.

En resumen y confirmación mostrar **“Por favor, estar 5 minutos antes de su reserva.”**, dirección, cancelación hasta 30 minutos antes y anulación por ausencia tras 5 minutos de tolerancia. El consejo de llegada no adelanta la hora de inicio ni ocupa cinco minutos adicionales automáticamente. Tras guardar, ofrecer conexión opcional a Google Calendar; error o rechazo de Google no cancela la reserva. Ver [integración](12-google-calendar.md).

Si otro cliente tomó el horario, no se crea la cita: mostrar “Ese horario acaba de ocuparse. Elige otra hora” y actualizar opciones. Un fallo posterior al mostrar un aviso flotante no debe deshacer una reserva válida; el aviso permanece consultable en Supabase.

Propuesta D06: confirmación inmediata al guardar. Si el dueño requiere aprobación manual, habrá que agregar un estado pendiente, su plazo de vencimiento y la regla de bloqueo antes de implementar ese flujo.

## 3. Cálculo de disponibilidad

Propuesta D03 para los dos peluqueros confirmados: cada uno representa capacidad simultánea de uno y tiene agenda propia. El administrador no agrega capacidad. Solo habrá dos cupos simultáneos cuando ambos peluqueros estén disponibles y los recursos lo permitan. No representar capacidad mayor a uno como un simple contador sin asignación de recursos.

```text
Fin del servicio = inicio + duración guardada del servicio
Fin de ocupación = fin del servicio + margen posterior configurado
Disponible = ocupación completa dentro de un intervalo habilitado
             y sin cruce con otra ocupación activa del profesional
             y dentro de las reglas de anticipación y horizonte
```

El horario efectivo es la intersección entre apertura del local y jornada del profesional, aplicando primero sus respectivas excepciones por fecha. Restar bloqueos puntuales, citas y atenciones espontáneas en curso. Las horas candidatas avanzan según el paso configurable de D05, anclado al inicio de cada intervalo efectivo del día.

Usar intervalos `[inicio, fin)`: una ocupación que termina a las 10:30 permite otra a las 10:30. Incluir cualquier margen posterior dentro del intervalo reservado. La duración no equivale al paso entre horas ofrecidas.

Ejemplo ficticio: jornada 09:00–12:00, servicio de 30 minutos y margen de 10. Una reserva a las 11:30 no cabe porque ocuparía hasta las 12:10. No usar estos números como configuración real.

Con cierre a las 21:00, bloques propuestos y margen cero, los límites de inicio son 20:15 normal, 20:10 diseño/con barba y 20:00 completo. La cuadrícula elegida puede ofrecer como última hora una anterior. Comprobar también jornada individual y ocupaciones; no liberar automáticamente antes un turno porque el corte terminó más rápido que su bloque reservado.

La validación del cliente es orientativa; la base de datos debe impedir cruces concurrentes. Crear bloqueos, modificar horarios y reservar deben coordinarse con la misma estrategia transaccional. Al cambiar horarios, rechazar el cambio si deja citas futuras fuera de jornada y presentar las afectadas; resolverlas explícitamente antes de reintentar.

Propuesta inicial: jornadas dentro del mismo día. Si el local trabaja de noche cruzando medianoche, adaptar intervalos y pruebas antes de cargar el horario real.

### Descansos, almuerzo e imprevistos

El peluquero puede crear/modificar/retirar bloqueos de su propia agenda y el administrador de cualquiera; no se habilita al cliente. Pedir inicio, fin y motivo privado. Confirmar el intervalo en servidor y guardarlo en la misma tabla de ocupaciones que las citas, con auditoría. El público solo verá que no hay disponibilidad, nunca el motivo.

Un bloqueo que cruza una reserva vigente se rechaza y muestra al personal las citas afectadas. Resolverlas mediante reprogramación o cancelación autorizada antes de bloquear; no borrarlas silenciosamente. Si bloqueo y reserva llegan simultáneamente, solo una operación puede confirmar el intervalo. Retirar un bloqueo libera únicamente esa ocupación, no modifica citas. Los descansos no amplían la jornada ni agregan capacidad.

## 4. Cancelación, reprogramación y estados

| Estado de cita | Uso | Ocupación |
| --- | --- | --- |
| `confirmed` | Turno reservado, llegada aún no registrada | Activa hasta cambio de estado o vencimiento de la tolerancia. |
| `checked_in` | Cliente llegó dentro del plazo, puede estar esperando | Conserva el turno; no anular por demora del peluquero. |
| `in_progress` | Atención iniciada | Activa durante el intervalo reservado. |
| `completed` | Servicio terminado | Conservar el intervalo histórico; nunca volver a ofrecer el pasado. |
| `cancelled` | Cancelada por cliente o personal autorizado | Liberar ocupación e invalidar recordatorios pendientes. |
| `no_show` | Anulada por inasistencia después de la tolerancia | Liberar lo restante, invalidar avisos y sincronizar cancelación; conservar historial. |

Transiciones: `confirmed → checked_in → in_progress → completed`, `confirmed → cancelled` y `confirmed → no_show`. Una llegada puntual puede registrarse junto al inicio de atención en una transacción; jamás inferir ausencia solo porque el corte no comenzó. Una atención iniciada no se cancela como si nunca hubiera ocurrido.

**Cancelación confirmada:** permitir al dueño de la cita mientras `server_now <= starts_at - 30 minutos`; a 29 minutos ya no. Validar enlace privado de esa cita (cliente) o sesión y permisos del personal, estado y límite en servidor. Propuesta: el personal también respeta el límite salvo una excepción administrativa con motivo que se apruebe explícitamente; no conceder saltos de política por ocultar el botón.

**Tolerancia confirmada:** registrar llegada con reloj del servidor hasta `starts_at + 5 minutos`, inclusive. Una cita de las 15:00 puede cancelarse hasta las 14:30 y registrar llegada hasta las 15:05. Después, si sigue `confirmed` sin llegada, pasa a `no_show`, etiqueta “Anulada por inasistencia”. No borrar la fila ni contar una venta.

Propuesta de ejecución: proceso periódico en servidor, aun sin navegador abierto, más normalización de vencidas antes de consultar/confirmar disponibilidad. La regla efectiva de vencimiento es `server_now > starts_at + 5 minutos`, independientemente de cuándo el proceso escriba el estado. Cancelación, llegada, vencimiento y nuevas reservas comparten el bloqueo transaccional del local y revalidan. Un proceso cada minuto puede materializar el estado después del límite; la API no debe aceptar una llegada tardía ni conservar un cupo vencido solo por ese retraso. Una llegada registrada a tiempo impide la anulación. No permitir backdating desde el cliente; correcciones administrativas requieren auditoría y no pueden invadir nuevas reservas.

Reprogramar mantiene el identificador y aumenta `schedule_version`; mover ocupación, registrar evento, invalidar notificaciones anteriores, crear nuevas y encolar actualización Google si está conectada, en una transacción. Si falla, conservar íntegramente la reserva anterior. El plazo de reprogramación no está confirmado: proponer inicialmente gestión por personal dentro de políticas válidas. Esto no bloquea la cancelación propia hasta 30 minutos antes, que sí fue confirmada.

## 5. Atención con cita y venta

1. El peluquero asignado o administrador registra llegada y luego inicio de atención, separando espera del cliente y trabajo realizado.
2. Al finalizar, confirma los servicios efectivamente realizados desde el catálogo.
3. El servidor obtiene los precios aplicables, calcula líneas y total y solicita confirmar el medio de pago.
4. Al registrar el cobro, guarda una venta y sus líneas y cierra la atención en una transacción idempotente.
5. Si la atención se cerró antes de registrar el cobro, permanece visible como pendiente de venta; posteriormente se registra una única venta para esa atención.

Medios confirmados: **efectivo, transferencia y Deuna**, todos pagados directamente en el local. Registrar `cash`, `bank_transfer` o `deuna` según verificación manual del personal; no iniciar pagos ni consultar bancos o Deuna. La reserva y la elección de un medio no constituyen un cobro. Moneda `USD`.

Propuesta D04: guardar el precio cotizado al reservar y respetarlo para el servicio originalmente reservado. Si se cambia el servicio o se agregan otros, mostrar y confirmar el nuevo importe antes de cobrar. El dueño debe definir excepciones. Los precios de venta son copias históricas, no consultas dinámicas al catálogo actual.

Cambiar servicios puede cambiar la duración. Validar una extensión antes de consumir otro turno; si no cabe, informar el conflicto. Los retrasos o tiempos reales se registran, pero no desplazan automáticamente a otros clientes.

## 6. Corte sin cita previa

**Atención que comienza ahora:** el personal selecciona profesional, servicio y cliente, o “cliente ocasional” si D09 lo permite. El servidor comprueba un espacio suficiente y crea una ocupación inmediata de origen `walk_in`, una cita operativa `in_progress` y su atención asociada. No envía recordatorios. Al cobrar sigue el mismo flujo de venta.

**Corte ya realizado que faltó registrar:** entrada administrativa retrospectiva, con fecha/hora real, servicio y motivo. Crea una atención sin cita y su venta; no inventa una reserva ni bloquea el calendario actual. Solo roles autorizados. Conservar cuándo sucedió y cuándo se registró para auditar diferencias. La retroactividad máxima se define en D08.

No exigir una cuenta de cliente para registrar una venta presencial. La persona que registra el cobro sí debe autenticarse. Un cliente no puede usar este flujo para omitir la disponibilidad pública.

## 7. Dashboard y definición de vendido — propuesta D08

Métrica principal: **ventas cobradas registradas**, calculadas desde ventas en estado `posted` por `sold_at` (fecha del cobro), no por fecha de reserva ni por fecha de creación del registro.

```text
Ventas cobradas = suma de total_amount de ventas posted del período
Cantidad de ventas = número de ventas posted del período
Ticket promedio = ventas cobradas / cantidad de ventas
```

Si no hay ventas, total y cantidad son cero y el ticket promedio se presenta como “Sin ventas”. Cada corte de un registro con varias líneas no cuenta como una venta separada. Mostrar servicios realizados como otra métrica solo si se implementa explícitamente.

| Filtro | Regla propuesta |
| --- | --- |
| Día | Día natural del local, desde las 00:00 hasta el inicio del siguiente día. |
| Semana | Lunes a domingo de la semana elegida; confirmar inicio de semana. |
| Mes | Mes calendario elegido, no últimos 30 días. |
| Rango | Fecha inicial y final incluidas en la interfaz; rechazar inicio posterior al fin. |

Convertir los límites locales a instantes UTC y consultar `sold_at >= inicio AND sold_at < día_siguiente_al_fin`. No depender de la zona horaria del teléfono. Completar con cero los días sin ventas y usar el mismo conjunto de datos para tarjetas, gráficos y tabla.

Excluir citas futuras, canceladas, ausencias y atenciones sin cobro. Incluir ventas con cita y sin cita sin duplicarlas. Propuesta: una anulación por error, exclusiva del administrador y con motivo, cambia la venta a `voided` y recalcula el período original; conservar registro y auditoría. El historial consultado puede cambiar por correcciones retroactivas. Si se requiere cierre de caja inmutable o devoluciones, definir un modelo de ajustes antes de implementarlos.

El dashboard representa este registro operativo de ventas, no utilidad, conciliación bancaria ni facturación fiscal.
