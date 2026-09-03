# 01 — Alcance y requisitos

Estado: borrador funcional v0.3, actualizado el 31 de agosto de 2026. Consultar [decisiones](10-decisiones-y-pendientes.md) y [datos de El Dorado Barbería](11-ficha-del-negocio.md). Confirmados nombre/dirección, USD, cuatro rangos de duración y precios, apertura 09:00–21:00 diaria, dos peluqueros y administrador, pagos presenciales, cancelación, tolerancia y descansos. Faltan jornadas individuales y detalles identificados como propuestas.

## Objetivo

Centralizar la agenda y el registro de ventas para conocer cuándo se atenderá a cada cliente, evitar cruces de turnos, enviar recordatorios y consultar cuánto se ha vendido, incluyendo las atenciones sin reserva.

## Usuarios y permisos propuestos — D03

| Usuario | Acceso previsto |
| --- | --- |
| Visitante | Información pública, servicios habilitados y horas disponibles; sin datos de otros clientes. |
| Cliente identificado | Reservar y consultar sus propias citas; cancelar o reprogramar según política. |
| Peluquero | Recibir recordatorios y bloquear descansos. Propuesta: gestionar su propia agenda y registrar llegada/atención; permiso de cobro por definir. |
| Dueño / administrador | Lo anterior, más horarios, precios, usuarios, reportes y anulaciones. |

El equipo inicial tiene dos agendas de peluquero y dos accesos administrativos; una de las cuentas administrativas también atiende como peluquero. Los administradores pueden invitar nuevos miembros desde el panel. Una cuenta administrativa solo agrega capacidad si tiene un perfil profesional activo, servicios y jornada. No se habilita autorregistro administrativo ni asignación de roles desde el perfil editable del usuario.

## MVP

| ID | Funcionalidad | Resultado esperado |
| --- | --- | --- |
| RF01 | Catálogo de servicios | Nombre, precio y duración configurable; desactivación sin perder el historial. |
| RF02 | Horario de atención | Jornadas por día, descansos y excepciones por fecha. |
| RF03 | Disponibilidad | Ofrecer solo intervalos completos que puedan atenderse. |
| RF04 | Reserva por el cliente | Seleccionar servicio, fecha y hora; confirmar tras validación del servidor. |
| RF05 | Agenda del negocio | Ver y gestionar turnos por fecha y, si aplica, profesional. |
| RF06 | Recordatorios | Flotantes persistidos en Supabase para peluqueros y administrador; recuperar solo los vigentes. Peluquero asignado + administrador, 10 minutos antes confirmados. |
| RF07 | Atención con cita | Vincular el servicio realizado a su reserva sin duplicarlo. |
| RF08 | Atención sin cita | Registrar un corte espontáneo y su venta con el mismo control de precios. |
| RF09 | Venta | Guardar servicio, precio aplicado, total, fecha, medio de pago y responsable. |
| RF10 | Dashboard | Totales por día, semana, mes y rango; detalle que explique cada total. |
| RF11 | Administración | Gestionar configuración y acceso según el rol. |
| RF12 | Seguridad | Impedir lectura o modificación de información ajena y ventas por clientes. |
| RF13 | Google Calendar | Cliente conecta opcionalmente su calendario; propuesta de sincronización app → Google de alta, reprogramación y cancelación del evento. |
| RF14 | Descansos | Administrador y peluquero bloquean intervalos no disponibles; no sobrescribir citas existentes. |
| RF15 | Cancelación y llegada | Autoservicio hasta 30 minutos antes; registrar llegada y anular por inasistencia tras tolerancia de 5 minutos. |
| RF16 | Recomendación al reservar | Mostrar “Por favor, estar 5 minutos antes de su reserva.” en resumen y confirmación. |
| RF17 | Usuarios del equipo | Administradores pueden invitar administradores o peluqueros; alta privada, sin autorregistro ni sobrescritura de roles existentes. |

## Criterios de operación propuestos

- Un local en la primera versión con dos peluqueros y dos administradores. Mantener dos agendas de atención, sujetas a las jornadas reales; no asumir otro cupo por agregar un administrador.
- Una cita reserva un servicio principal y un profesional. La venta puede incluir varias líneas del catálogo cuando se realizaron servicios adicionales.
- Una cita, una atención y una venta son conceptos distintos. Una cita reservada no es una venta.
- Pago confirmado fuera de la aplicación: efectivo, transferencia o Deuna, directamente en el local. Propuesta: registrar al finalizar el importe recibido, el medio y el responsable; sin pasarela ni verificación bancaria automática.
- Proponer ventas cobradas como cifra principal del dashboard. Confirmar significado de “vendido” en D08.
- El servicio puede quedar atendido y pendiente de registrar su cobro; ese caso debe verse en una lista de pendientes y no sumar al total cobrado.
- No admitir sobreturnos silenciosos. Un conflicto requiere resolver la agenda, no ignorar la validación.

## Requisitos no funcionales

- Interfaz en español; adaptación a móvil, tableta y escritorio.
- Controles utilizables con teclado, etiquetas explícitas, foco visible y errores comprensibles.
- Persistencia real en Supabase; no usar almacenamiento local como base de datos del negocio.
- Zona horaria del local explícita y configurable; fechas de eventos guardadas con zona horaria.
- Acceso restringido a contactos, ventas y reportes. Registro de cambios sensibles.
- Manejo seguro de doble clic, solicitudes simultáneas, pérdida de conexión y reintentos.
- Si no se puede verificar disponibilidad, impedir la confirmación e informar el problema.
- Datos ficticios para pruebas. Copias de seguridad y recuperación acordadas antes de producción.

## Fuera del alcance inicial

Pagos en línea, anticipos, cuentas por cobrar, pagos parciales o mixtos, facturación electrónica, contabilidad fiscal, inventario, comisiones, nómina, gastos, rentabilidad, campañas de marketing, fidelización, lista de espera, aplicación móvil nativa y múltiples locales. Google Calendar sí se incorpora: quedan fuera sincronización bidireccional, calendarios de otros proveedores y lectura de eventos personales para calcular cupos.

Los descuentos, impuestos, propinas y devoluciones monetarias necesitan una decisión en D08. No incorporarlos implícitamente al cálculo de ventas. Una anulación por error de registro no equivale a una devolución de dinero. También quedan fuera los recordatorios por correo, WhatsApp, SMS y notificaciones del sistema/Web Push; la notificación flotante confirmada no funciona con la web cerrada.

## Qué se necesita para abrir al público

Falta completar margen/paso de agenda, validar bloques propuestos a partir de los rangos recibidos, zona horaria técnica, jornadas/nombres del equipo y política de reprogramación. El acceso de clientes ya está confirmado: sin cuenta y con nombre/celular/correo obligatorios. Para Google Calendar se requieren configuración OAuth y pruebas; la reserva no debe depender de conectar Google. Además, responsables de operación, configuración de seguridad y evidencia de las pruebas críticas. Los pendientes no impiden preparar el código, pero sí impiden dar la configuración del negocio por finalizada.
