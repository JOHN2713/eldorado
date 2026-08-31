# 11 — Ficha de El Dorado Barbería

Actualización: 31 de agosto de 2026. Datos aportados por el usuario y transcritos del cartel adjunto. Esta ficha describe la configuración del negocio; ya está incluida en la vista previa y los scripts iniciales; todavía no se ha instalado en Supabase remoto.

## Identidad y procedencia

- **Nombre:** El Dorado. **Actividad / descriptor:** Barbería. Nombre de presentación: **El Dorado Barbería**.
- Referencia visual: cartel negro, dorado y blanco con corona y ornamentos. Falta un archivo original del logotipo adecuado para la interfaz.
- La frase promocional del cartel no constituye una instrucción de desarrollo ni parte obligatoria del nombre.
- El teléfono está cubierto en la imagen; no se transcribe ni se intenta reconstruir.
- **Dirección indicada:** Zámbiza, calle Quito. Faltan número/referencia y contacto público. Zona horaria técnica propuesta: `America/Guayaquil`, por validar al configurar el local.
- **Moneda:** dólar estadounidense, `USD`, con dos decimales.

## Horario confirmado por mensaje

| Día | Apertura | Cierre |
| --- | --- | --- |
| Lunes | 09:00 | 21:00 |
| Martes | 09:00 | 21:00 |
| Miércoles | 09:00 | 21:00 |
| Jueves | 09:00 | 21:00 |
| Viernes | 09:00 | 21:00 |
| Sábado | 09:00 | 21:00 |
| Domingo | 09:00 | 21:00 |

**Prevalece el mensaje del usuario sobre el cartel**, que muestra lunes a sábado de 09:00 a 19:00. No usar ese horario impreso para configurar el aplicativo.

La apertura del local no implica que ambos peluqueros trabajen las doce horas todos los días. Faltan sus jornadas y excepciones habituales. **El administrador y cada peluquero podrán bloquear descansos**, almuerzo o imprevistos. Propuesta de permisos: el peluquero sobre su agenda y el administrador sobre cualquiera; rechazar bloqueos que invadan reservas existentes hasta resolverlas explícitamente.

## Personal

| Integrante | Cantidad confirmada | Pendiente |
| --- | --- | --- |
| Peluqueros | 2 | Nombres, jornadas y servicios habilitados. Acceso necesario para recibir avisos y bloquear sus descansos. |
| Administrador | 1 | Nombre, cuenta y si también realiza cortes. |

Propuesta: dos agendas independientes, capacidad de un cliente por peluquero cuando esté disponible. El administrador **no agrega un tercer cupo** de atención. Confirmar recursos compartidos y si el cliente elige peluquero.

## Catálogo transcrito del cartel

| Servicio | Precio USD | Duración estimada confirmada | Bloque de agenda propuesto |
| --- | --- | --- | --- |
| Corte normal | $5.00 | 30–45 minutos | 45 minutos |
| Corte con diseño | $6.00 | 40–50 minutos | 50 minutos |
| Corte con barba | $6.50 | 40–50 minutos | 50 minutos |
| Corte completo | $8.00 | 50–60 minutos | 60 minutos |

El cartel muestra “con turnos” bajo corte completo. Confirmar si indica una condición exclusiva de ese servicio; no interpretarlo como prohibición de walk-ins, que sí fueron solicitados para el aplicativo. Falta detallar qué incluye el corte completo.

Los precios proceden del cartel; la moneda dólar fue confirmada posteriormente por el usuario. Impuestos incluidos y posibles variantes siguen pendientes. “Barba” en el último mensaje se vincula al servicio existente “Corte con barba”; no se crea un servicio adicional de barba sola sin otra tarifa.

Los rangos específicos sustituyen al rango general anterior. Se propone usar el extremo superior para reservar tiempo suficiente, separando duración estimada, tiempo bloqueado y tiempo real de atención. Esta elección técnica está identificada como propuesta; ya no se propone 60 minutos uniformes para todos los servicios. El margen adicional y el paso entre horas ofrecidas siguen pendientes y deben ser configurables.

Con los bloques propuestos y margen cero, el último inicio que cabe hasta las 21:00 es 20:15 para normal, 20:10 para diseño/barba y 20:00 para completo. Son límites de encaje, no horas garantizadas: la cuadrícula, el horario del peluquero y las reservas pueden hacer que la última opción disponible sea anterior.

## Pago, cancelación y llegada

- **Pago directo en el establecimiento:** efectivo, transferencia o Deuna. La web no cobra ni integra pasarela/banco/Deuna; el personal registra manualmente el medio y el importe realmente recibido.
- **Cancelación por el cliente:** permitida hasta 30 minutos antes del inicio, incluido ese límite. Después se rechaza el autoservicio; las excepciones administrativas se mantienen pendientes.
- **Espera:** 5 minutos después de la hora reservada. Si no se registró llegada dentro de esa tolerancia, anular por inasistencia, conservar historial y liberar lo restante del turno.
- Recomendación al reservar: **“Por favor, estar 5 minutos antes de su reserva.”** Mostrar en resumen y confirmación; también en la descripción del evento de Google si el cliente lo conecta. No adelantar la hora efectiva de la cita por ese mensaje.
- El peluquero asignado o el administrador registra la llegada; una persona llegada a tiempo no pierde la reserva por esperar que comience el servicio.
- La política de reprogramación todavía se debe definir; no confundirla con el plazo de cancelación ya confirmado.

## Recordatorios y repositorio

- **Canal confirmado:** notificación flotante dentro del aplicativo web.
- **Límite:** visible con el aplicativo abierto y una sesión autorizada; no produce un aviso fuera de la web cuando está cerrada.
- **Destinatarios confirmados:** peluqueros y administrador. Propuesta de distribución: el peluquero asignado recibe los de su agenda y el administrador los de todas las citas; no avisar al otro peluquero sobre clientes ajenos por defecto. Anticipación confirmada: 10 minutos antes.
- El cliente no recibe estos flotantes internos. Puede conectar opcionalmente su Google Calendar; los avisos que genere Google son independientes de los del personal.
- No se incluyen WhatsApp, correo, SMS ni Web Push como canal de recordatorios del MVP.
- **Repositorio indicado por el usuario:** [JOHN2713/eldorado](https://github.com/JOHN2713/eldorado).
- La consulta web del enlace no permitió verificar su contenido. No se infiere que sea privado o inexistente; faltan verificar acceso, rama y contenido antes de sincronizar. No se ha realizado push ni modificado el remoto.

## Google Calendar del cliente

Requisito incorporado: permitir al cliente sincronizar su turno con su Google Calendar si lo desea. Es viable mediante autorización de su cuenta. Propuesta: sincronización en un sentido, desde la reserva hacia un evento propio de la app, incluyendo cambios de horario y cancelación; editar el evento en Google no modifica la reserva. Consultar [diseño y límites de Google Calendar](12-google-calendar.md). No hay ninguna cuenta conectada ni evento creado en esta primera entrega local.

## Acceso confirmado

Clientes sin cuenta ni contraseña: nombre, celular y correo obligatorios. Solo administrador y dos peluqueros tienen cuentas. Cada reserva entrega un enlace privado para consulta/cancelación. El correo no autoriza automáticamente Google Calendar.

## Próximos datos prioritarios

1. Margen entre clientes, paso de la agenda y validar bloques propuestos de 45/50/50/60 minutos.
2. Nombres y jornadas de los dos peluqueros y del administrador; permisos de cobro por completar.
3. Crear proyecto Supabase y cuentas del personal; avisos a 10 minutos ya confirmados.
4. Referencia de dirección, contacto público, zona horaria técnica; acceso sin cuenta ya confirmado.
5. Reprogramación, anticipación de reservas y excepciones; responsable de configurar OAuth de Google.

Los datos confirmados pueden prepararse como configuración; los campos pendientes no deben completarse con supuestos silenciosos. Ver [decisiones](10-decisiones-y-pendientes.md) y [ficha de reunión](09-reunion-con-el-dueno.md).
