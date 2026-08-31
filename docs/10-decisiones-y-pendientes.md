# 10 — Decisiones y pendientes

Fuente de verdad de acuerdos. Última actualización: 31 de agosto de 2026. Las propuestas de este paquete no equivalen a aprobación del dueño. Los datos recibidos están detallados en la [ficha de El Dorado Barbería](11-ficha-del-negocio.md). El mensaje directo del usuario prevalece sobre datos contradictorios del cartel adjunto.

## Confirmado por el usuario y la referencia aportada

| ID | Decisión | Estado |
| --- | --- | --- |
| C01 | Aplicativo de peluquería con agenda y reserva por clientes | Confirmado |
| C02 | Validación de horario disponible y turnos existentes | Confirmado |
| C03 | Recordatorios flotantes para peluqueros y administrador | Confirmado: 10 minutos antes para administrador y peluquero asignado |
| C04 | Registro de servicios cobrados desde lista de precios del dueño | Cuatro precios y USD recibidos; pagos directos confirmados |
| C05 | Registro de cortes sin cita previa | Confirmado |
| C06 | Dashboard por día, semana, mes y rango de días | Confirmado; definición monetaria pendiente |
| C07 | Base de datos propia del aplicativo en Supabase | Confirmado |
| C08 | HTML, Tailwind CSS, JavaScript y diseño responsive | Confirmado |
| C09 | Negro, títulos dorados y subtítulos blancos | Confirmado; códigos exactos propuestos |
| C10 | Iniciar desarrollo de la aplicación con la documentación existente; publicar después | Desarrollo autorizado |
| C11 | Existe una suscripción Railway según el usuario | Confirmado por usuario; cuenta y plan no verificados |
| C12 | Nombre de presentación: El Dorado Barbería | Transcrito del cartel aportado |
| C13 | Apertura de lunes a domingo, de 09:00 a 21:00 | Confirmado por mensaje; reemplaza lunes–sábado 09:00–19:00 del cartel |
| C14 | Dos peluqueros y un administrador | Confirmado; acceso del peluquero necesario para avisos/descansos; nombres y jornadas pendientes |
| C15 | Normal 30–45, diseño 40–50, con barba 40–50, completo 50–60 minutos | Rangos específicos confirmados; bloques máximos propuestos, margen pendiente |
| C16 | Corte normal $5.00; con diseño $6.00; con barba $6.50; completo $8.00 | Precios del cartel, moneda USD confirmada posteriormente |
| C17 | Repositorio indicado: GitHub JOHN2713/eldorado | URL aportada; contenido/acceso sin verificar, sin push |
| C18 | Dirección: Zámbiza, calle Quito; moneda dólar USD | Confirmado por mensaje; referencia/contacto y zona técnica por completar |
| C19 | Pago directo en el establecimiento: efectivo, transferencia o Deuna | Confirmado; sin integración de pago en la web |
| C20 | Cliente puede cancelar hasta 30 minutos antes | Confirmado; incluir límite exacto en validación de servidor |
| C21 | Espera de 5 minutos tras hora reservada; después anular si no llegó | Confirmado; propuesta técnica de registrar llegada y estado `no_show` sin borrar historial |
| C22 | Recomendación: “Por favor, estar 5 minutos antes de su reserva.” | Confirmado; mostrar al reservar sin adelantar hora real |
| C23 | Administrador o peluquero pueden colocar descansos por almuerzo/imprevistos | Confirmado; propuesta de peluquero sobre su agenda, admin sobre cualquiera |
| C24 | Permitir al cliente sincronizar su turno con Google Calendar | Solicitado; viable con autorización OAuth opcional por reserva, aún no implementado |
| C25 | Clientes reservan libremente sin cuenta, con nombre, celular y correo obligatorios; cuentas solo para administrador y dos peluqueros | Confirmado; reemplaza la propuesta de Auth para clientes |
| C26 | Los avisos de actualización deben desaparecer después de 10 segundos | Confirmado para avisos de operaciones; no cambia la anticipación de 10 minutos ni la vigencia de los recordatorios de citas |

## Decisiones abiertas

Responsable de respuestas de negocio: dueño, coordinado por el usuario. Responsable de validar viabilidad técnica: equipo de desarrollo. Fechas objetivo por acordar en la reunión.

| ID | Tema | Propuesta de partida, si existe | Impacto antes de producción |
| --- | --- | --- | --- |
| D01 | Identidad y ubicación | Nombre y Zámbiza, calle Quito confirmados; referencia precisa/contacto pendientes | Información pública y confirmaciones. |
| D02 | Moneda y zona horaria | USD confirmado; zona `America/Guayaquil` propuesta a validar al configurar | Cálculos y límites de fecha. |
| D03 | Capacidad y equipo | Dos peluqueros con acceso a avisos/descansos y un administrador; nombres/jornadas/permisos de cobro pendientes. Propuesta de dos agendas | Agenda, recursos y permisos. |
| D04 | Catálogo y precio histórico | Rangos por servicio recibidos. Propuesta: bloques de 45/50/50/60 minutos; margen y política de precio reservado pendientes | Disponibilidad y cobro. |
| D05 | Horarios y paso de agenda | Apertura 09:00–21:00 todos los días y descansos por personal confirmados; jornadas, descansos habituales, excepciones y cuadrícula pendientes | Disponibilidad real. |
| D06 | Política de reserva | Confirmación inmediata; anticipación, horizonte y límites configurables | Reserva pública. |
| D07 | Cambios, atraso y ausencia | Cancelación hasta 30 min antes, tolerancia 5 min y recomendación de llegar 5 min antes confirmadas. Reprogramación y excepciones pendientes | Estados y liberación de horarios. |
| D08 | Ventas y correcciones | Efectivo/transferencia/Deuna directos confirmados; registro manual. Propuesta de venta cobrada al cierre; correcciones y extras pendientes | Cobros, cifras y correcciones. |
| D09 | Acceso y datos del cliente | Reserva sin cuenta con nombre/celular/correo; Auth exclusivo del personal; enlace privado por reserva y CAPTCHA como diseño técnico | Auth, propiedad de citas y formularios. |
| D10 | Reportes y permisos | Dashboard del administrador; semana lunes a domingo | Acceso y agregaciones. |
| D11 | Notificaciones internas | Flotantes a administrador y peluquero asignado 10 minutos antes, confirmado. Sin avisos fuera de la web cerrada | Audiencia, programación y pruebas. |
| D12 | Privacidad y conservación | Recoger lo mínimo y restringir bandejas por destinatario; revisión según país real | Datos de clientes, lectura de avisos y conservación. |
| D13 | Marca | Nombre y cartel recibidos; falta logotipo original, textos finales y validar códigos exactos de paleta | Apariencia final. |
| D14 | Infraestructura y responsables | Repositorio JOHN2713/eldorado aportado; faltan acceso/rama/cuentas/dominio. Railway + Supabase siguen propuestos | Publicación, presupuesto y recuperación. |
| D15 | Entregas y ampliaciones | MVP por fases, un local; ampliaciones fuera de alcance | Planificación y aceptación. |
| D16 | Google Calendar del cliente | Requisito aceptado en alcance; propuesta optativa app → Google, OAuth y cambios/cancelaciones. Configuración, calendario destino y permisos por completar | Integración y consentimiento. |

**Parcialmente resueltos:** D01–D05, D07, D08, D11, D13, D14 y D16, con los hechos confirmados arriba. D09 resuelto en acceso y datos exigidos; recuperación/retención por completar. D06, D10, D12 y D15 siguen pendientes. No volver a preguntar datos ya recibidos: nombre/dirección, USD, precios/rangos, horario, equipo, destinatarios, canal, pagos, cancelación, tolerancia, descansos o URL. Preguntar solo los detalles restantes.

## Propuestas técnicas que no requieren inventar datos del negocio

- Vite para construir el frontend de HTML/Tailwind/JavaScript.
- Supabase Auth solo para el personal. Clientes sin Auth: gateway de servidor, CAPTCHA, límites y enlace privado por reserva; RLS y funciones SQL protegidas.
- Restricción de ocupaciones y serialización de cambios de agenda para evitar dobles reservas.
- Separación entre cita, atención y venta, con precios históricos e idempotencia.
- Notificaciones persistidas en Supabase, con vigencia validada por el servidor, consulta desde la web abierta y Realtime opcional; sin scheduler ni proveedor de envío para este diseño.
- Sí se requieren procesos independientes de servidor para inasistencias y Google Calendar: propuesta de Cron + función SQL para vencimientos y Edge Function para la API Google. El alcance de flotantes no cambia.
- Bloquear máximos de duración 45/50/50/60 minutos; registrar llegada separada del inicio del corte y compartir control de concurrencia con descansos/citas.
- Migraciones versionadas, pruebas de permisos/concurrencia/cobros y revisión responsive.

Estas decisiones pueden desarrollarse como base técnica, revisando su compatibilidad al cerrar los pendientes. Ninguna confirma que una función ya exista.

## Riesgos y respuesta prevista

| Riesgo | Respuesta |
| --- | --- |
| Reservar el mínimo de un rango y cruzar turnos | Proponer el máximo de cada rango como bloque; registrar duración real por separado. |
| Varios clientes intentan tomar el mismo turno | Validación transaccional y restricción en base de datos. |
| Corte espontáneo invade una reserva | Registrar ocupación inmediata y verificar espacio completo. |
| Cambiar precio modifica ventas pasadas | Copias históricas inmutables por línea de venta. |
| Sumar reservas como ventas | Reportar desde ventas cobradas, sujeto a D08. |
| Cliente ve información de otra persona | RLS, permisos mínimos y pruebas directas de API. |
| Flotantes duplicados o de citas canceladas | Versiones de agenda, concesiones de presentación, revalidación y unicidad por destinatario. |
| Esperar un aviso con la página cerrada | Explicar el límite de los flotantes; Web Push requeriría un alcance adicional. |
| Presupuesto supone servicios gratuitos | Revisar plan Railway y Supabase; no asumir Vercel Hobby comercial. |
| Caída o pérdida de datos | Plan de respuesta, respaldos y restauración verificada. |
| Cliente llegó pero el peluquero aún no comenzó | Registrar llegada; excluir `checked_in` del vencimiento por inasistencia. |
| Fallo Google o revocación de permisos | Conservar la reserva, mostrar estado de sincronización y reconciliar solo eventos de la app. |

## Historial

### Horarios públicos y atención ocupada — 31 de agosto de 2026

- Revisión de lectura en Supabase: reservas habilitadas, dos profesionales activos con roles, servicios y jornadas guardados. Se conservaron todas las configuraciones actuales del usuario, incluidos márgenes y jornadas, y no se crearon ni cancelaron citas.
- La API antigua en 3002 respondía al estado pero fallaba al consultar la base; el servidor en 3003 rechazaba los UUID del catálogo inicial por exigir bits de versión/variante que esos UUID de PostgreSQL no tienen. Corregida la validación de formato, manteniendo las verificaciones SQL, CAPTCHA y permisos. Nuevas pruebas usan los identificadores de las migraciones, además de rechazar entradas malformadas.
- Se detuvo la instancia antigua y se reinició la API en 3003 con acceso a Supabase. Proxy, servidor y mensaje local comparten `config/local-development.js`; producción conserva `PORT`. Consultas reales devolvieron HTTP 200 y horarios tanto por API como por Vite. La configuración previa de puerto 3002 queda sustituida.
- Un fallo al consultar ya no se presenta como ausencia de cupos ni conserva horarios anteriores. El rechazo de una atención sin cita explica que se necesita un bloque completo libre; no se retiran ocupaciones para forzar la atención. Se observó una ocupación activa que explicaba el rechazo informado por el usuario y se conservó intacta.
- La confirmación de una reserva y la validación real del CAPTCHA siguen pendientes; consultar horarios no confirma una cita.
- Verificado: 16 pruebas JavaScript/HTTP aprobadas y compilación correcta. En el navegador se muestran horas reales; el primer horario ofrecido al profesional con una atención activa respeta su fin de ocupación y la cuadrícula. No se completó el formulario de confirmación ni se crearon citas de prueba en la base remota.

### Puerto de la API local — 31 de agosto de 2026

- Verificado en Windows: VS Code ocupaba el puerto 3001. La API no podía iniciar y el callback de Express anunciaba éxito pese al error. Se cambia el puerto local de API y proxy Vite a 3002, que estaba libre, sin cerrar VS Code. Producción conserva `PORT` y el valor predeterminado 3000.
- El arranque informa los errores de escucha y termina con código 1 sin anunciar éxito. Se incorpora una prueba con puerto ocupado y sin credenciales reales. El frontend distingue API inaccesible/respuesta ajena de configuración incompleta e impone un tiempo máximo a la consulta de estado.
- Tras arrancar la API se verificaron respuestas HTTP 200 y `ready: true` tanto directamente en 3002 como por Vite en 5173. No se cambiaron claves ni se crearon reservas para esta comprobación; aún no constituye una prueba de CAPTCHA y reserva completos.
- Verificación de código: 14 pruebas JavaScript/HTTP aprobadas, incluidas la colisión de puerto y las respuestas HTTP 426/no válidas; compilación de producción correcta.

### Avisos y diagnóstico de activación — 31 de agosto de 2026

- Avisos de operaciones con cierre automático a los 10 segundos y cierre manual disponible. Los recordatorios de próxima cita conservan su vigencia y el registro del servidor.
- El panel muestra requisitos guardados por peluquero: cuenta y rol activos, nombre, servicios asignados y al menos un día de jornada. Las consultas usan la sesión administrativa y los permisos RLS existentes; el resumen no sustituye la validación de Supabase y no cambia roles ni habilita reservas por su cuenta.
- Se aclara que escribir horas sin marcar el día no lo habilita. El panel informa por separado si la API de reservas declara estar configurada; esto no verifica todavía sus credenciales ni el CAPTCHA real. Al consultar horarios se actualiza la configuración para no conservar un estado de activación anterior.
- Se prepararon los campos faltantes del archivo local de servidor, conservando los valores existentes. No se han obtenido ni inventado claves privadas. Sigue pendiente completar esas claves y revisar el requisito faltante del equipo en la sesión del administrador.
- Verificación: compilación de producción correcta y 11 pruebas JavaScript/HTTP existentes aprobadas. El navegador de comprobación no tiene la sesión administrativa del usuario; no se guardaron jornadas, se activaron reservas ni se crearon citas remotas durante este cambio. El detalle del equipo debe revisarse en su sesión.

### Configuración local del ingreso — 31 de agosto de 2026

- La URL y la clave pública se habían colocado únicamente en `.env.server.local`; faltaba `.env.local`, por lo que el frontend seguía en vista previa. Se creó el archivo local excluido de Git copiando solo las dos variables públicas, sin registrar valores en documentos ni modificar el archivo del servidor.
- Verificado en el navegador local: desapareció el aviso de configuración y quedó habilitado el botón Ingresar. No se introdujeron contraseñas ni se verificó una sesión administrativa; no se cambiaron cuentas, roles ni datos remotos. La configuración privada de las reservas públicas sigue pendiente.

### Soporte local de Windows — 31 de agosto de 2026

- Se detectó Node 22.11, inferior al mínimo del proyecto, y un error `EPERM unlink` al reinstalar con la vista previa abierta. Se detuvo esa vista previa y `npm ci` completó con Node 24.19 disponible en el equipo.
- Se añade `scripts/npm-local.ps1` para seleccionar un Node compatible y ejecutar npm y sus procesos sin cambiar la instalación global. No se modifica el requisito de Node, el contrato de la aplicación, las claves ni la base remota. Detener los servidores antes de reinstalar dependencias; instrucciones en [13](13-puesta-en-marcha.md).
- Verificación tras reinstalar: `npm ci` finalizó sin vulnerabilidades reportadas; mediante el auxiliar pasaron las 11 pruebas JavaScript/HTTP y la compilación de producción. No se probaron ni modificaron servicios remotos durante esta reparación.

### 0.5 — Clientes sin cuenta

- El usuario confirma que solo administrador y dos peluqueros tendrán cuentas. Los clientes reservan con nombre, celular y correo obligatorios, sin alta Auth ni contraseña.
- Se sustituye la propuesta anterior de identidad Auth del cliente. No volver a pedir confirmación sobre esta decisión.
- Implementación v0.2: API Node con CAPTCHA/límites, migración 004, enlace privado por cita y hash del token en esquema privado. No se crean cuentas de invitado ni se unen historiales por contacto no verificado.
- Nuevo requisito técnico de instalación: clave privada de Supabase y clave Turnstile **solo en servidor**. Desactivar inscripciones/usuarios anónimos en Supabase Auth; no se ha cambiado remotamente.
- Google Calendar sigue opcional por reserva, con OAuth independiente del login del personal. El correo no autoriza integración por sí solo. Detalle y pruebas: [15](15-reservas-sin-cuenta.md).

### 0.4 — Inicio de implementación, 31 de agosto de 2026

- Usuario confirma recordatorios **10 minutos antes al administrador y peluquero** y autoriza iniciar la aplicación.
- Se crea primera versión local con HTML/Tailwind/JavaScript, Vite, servidor para build, migraciones Supabase, scripts de instalación y pruebas. No se ha conectado una base remota ni publicado.
- Decisiones técnicas iniciales: Auth correo/contraseña verificada; solo administrador cobra y ve ventas; semana lunes–domingo; precio reservado conservado. Validación del dueño pendiente en los temas abiertos correspondientes.
- Valores iniciales revisables: zona America/Guayaquil, bloques 45/50/50/60, margen 0, cuadrícula 5, anticipación mínima 0 y horizonte 30 días. Límites de protección SQL: 5 reservas futuras por cliente, llegada desde 60 minutos antes y retroactividad de hasta 365 días. No son nuevos acuerdos de negocio.
- Reprogramación inicial por personal hasta 30 minutos antes, mismo servicio/profesional y precio reservado. No iniciar antes de la hora de reserva; si inicia tarde, exigir espacio suficiente para toda la duración. Estas decisiones conservadoras requieren validación del dueño.
- Reserva pública deshabilitada hasta asignar cuentas, servicios y jornadas reales de los dos peluqueros. No se cargan jornadas supuestas.
- Google Calendar automático sigue pendiente; `.ics` es solo una copia identificada como tal.
- Ver [puesta en marcha](13-puesta-en-marcha.md) y [estado real](14-estado-de-implementacion.md) para no confundir el diseño objetivo con lo probado/instalado.

| Fecha | Cambio | Origen |
| --- | --- | --- |
| 2026-08-30 | Creación del paquete documental v0.1 a partir de la solicitud inicial | Usuario / preparación técnica |
| 2026-08-30 | Railway queda como propuesta principal; documentada limitación comercial de Vercel Hobby | Revisión de fuentes enlazadas en despliegue |
| 2026-08-31 | Incorporados El Dorado Barbería, cuatro precios del cartel, horario 09:00–21:00 todos los días, dos peluqueros, administrador y rango 30–60 minutos | Cartel y mensaje del usuario; prevalece horario del mensaje |
| 2026-08-31 | Registrado repositorio indicado y sustituida mensajería externa por notificaciones flotantes internas | Mensaje del usuario; se revisaron arquitectura, datos, interfaz, pruebas y despliegue |
| 2026-08-31 | v0.3: destinatarios, rangos específicos, dirección/USD, pagos directos, cancelación 30 min, tolerancia 5 min, consejo de llegada y descansos | Nuevo mensaje del usuario; actualizados todos los módulos afectados |
| 2026-08-31 | Agregado requisito Google Calendar y diseño opcional de sincronización con OAuth | Solicitud del usuario y documentación oficial enlazada en documento 12 |

## Registro para próximos acuerdos

| Fecha | ID | Decisión aprobada | Responsable que confirma | Documentos actualizados |
| --- | --- | --- | --- | --- |
| 2026-08-31 | D01, D03–D05, D13 | Nombre/precios de referencia, apertura, cantidad de equipo y rango general de duración | Usuario mediante mensaje y cartel | Ficha 11, README, alcance, flujos, interfaz, pruebas y decisiones |
| 2026-08-31 | D11, D14 | Canal flotante interno y URL del repositorio | Usuario mediante mensaje | Arquitectura, modelo, recordatorios, despliegue, reunión y decisiones |
| 2026-08-31 | D01–D05, D07, D08, D11, D16 | Nuevas reglas operativas, avisos al personal y Google Calendar | Usuario mediante mensaje | README y documentos 01–12 |
| POR DEFINIR | POR DEFINIR | POR DEFINIR | POR DEFINIR | POR DEFINIR |
