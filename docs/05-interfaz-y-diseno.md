# 05 — Interfaz y diseño responsive

La combinación solicitada es negra con títulos dorados y subtítulos blancos. El nombre confirmado es **El Dorado Barbería** y el cartel adjunto sirve como referencia visual. Los valores exactos siguientes son una propuesta; falta el logotipo original y definir fotografías/textos finales en D13. No trasladar el horario antiguo ni el teléfono cubierto del cartel a la interfaz. Consultar la [ficha vigente](11-ficha-del-negocio.md).

## Paleta propuesta

| Uso | Color |
| --- | --- |
| Fondo principal | `#090909` |
| Superficie de tarjetas | `#171717` |
| Superficie elevada | `#222222` |
| Títulos, énfasis y foco | `#D4AF37` |
| Subtítulos y texto principal | `#FFFFFF` |
| Texto secundario | `#D1D5DB` |
| Separadores | `#404040` |
| Botón principal | Fondo `#D4AF37`, texto `#090909` |

No colocar texto blanco pequeño sobre fondo dorado. Reservar colores auxiliares para estados de éxito, advertencia y error acompañados de texto o icono. Medir contraste durante la implementación; la paleta propuesta aún no es una certificación de accesibilidad.

Tipografía inicial: familia del sistema, sin depender de fuentes externas. Si el dueño aporta una identidad tipográfica, validar licencia y legibilidad antes de incorporarla.

## Pantallas del cliente

| Pantalla / ruta propuesta | Contenido y acciones |
| --- | --- |
| Inicio `/` | Nombre del local, presentación, servicios y botón “Agendar cita”. |
| Reserva `/reservar` | Servicio → profesional si aplica → fecha y hora → nombre/celular/correo → CAPTCHA y confirmación sin cuenta. |
| Acceso del equipo `/ingresar` | Solo administrador y peluqueros; sin botón público para crear cuenta. |
| Mi reserva `/mi-reserva#TOKEN` | Una cita por enlace privado: consulta/cancelación y descarga ICS. No hay búsqueda por contacto ni historial de cuenta. |

El calendario público muestra disponibilidad, no la agenda nominal del negocio. Hay dos peluqueros; confirmar si el cliente puede elegirlos. Si se ofrece “Cualquiera disponible”, el servidor asigna uno concreto y lo devuelve en la confirmación. Mostrar apertura de 09:00 a 21:00 de lunes a domingo, sin prometer que ambos peluqueros están disponibles toda la jornada.

Mostrar precio en USD y rango estimado antes de confirmar, diferenciándolo del tiempo reservado propuesto: normal 45, diseño/barba 50 y completo 60 minutos. Ubicación: Zámbiza, calle Quito. Si falta configuración indispensable, deshabilitar la reserva con una explicación; no simular éxito. Conservar la selección tras un error recuperable sin exponer datos personales en la URL.

Mostrar en resumen y confirmación **“Por favor, estar 5 minutos antes de su reserva.”**, “Puedes cancelar hasta 30 minutos antes” y “La reserva se anula por inasistencia después de 5 minutos de tolerancia”. La hora de cita no cambia por la recomendación. “Cancelar” requiere nueva validación del servidor; un reloj del teléfono no decide si aún se permite.

Después de confirmar, ofrecer “Conectar Google Calendar y sincronizar esta cita”, sin exigirlo para reservar. Mostrar pendiente/sincronizada/error real y acción para desconectar o reautorizar. Las operaciones Google no deben bloquear el uso de la cita. Diseño detallado en [Google Calendar](12-google-calendar.md).

## Pantallas de operación

| Pantalla / ruta propuesta | Contenido y acciones |
| --- | --- |
| Agenda `/admin/agenda` | Vista del día y semana, filtros por profesional, estados y accesos a atención. |
| Nueva atención `/admin/atenciones/nueva` | Atención inmediata sin cita o registro retrospectivo claramente separados. |
| Cobro `/admin/cobros/:visitId` | Servicios realizados, precios, total, medio de pago y confirmación. |
| Pendientes `/admin/pendientes` | Atenciones completadas sin venta; acceso para registrar el cobro. |
| Dashboard `/admin/dashboard` | Filtros, totales, gráfico y tabla que permite revisar el cálculo. |
| Catálogo `/admin/servicios` | Servicios, precios, duración, margen y estado activo. |
| Configuración `/admin/configuracion` | Datos del local, horarios, excepciones, profesionales y políticas. |
| Equipo `/admin/equipo` | Usuarios y roles; solo administrador. |
| Descansos, dentro de la agenda | Crear, editar o retirar un bloqueo por almuerzo/imprevisto con inicio y fin. Peluquero sobre su agenda; administrador sobre cualquiera. |
| Llegada, dentro del detalle de cita | “Registrar llegada”, separada de “Iniciar corte”; distingue cliente esperando y anulación por inasistencia. |

Las rutas son orientativas; usar un espacio de personal equivalente para el peluquero sin darle rol administrativo por acceder a una URL. Proteger cada consulta y acción en servidor. En cobro, registrar pago recibido por efectivo, transferencia o Deuna; no mostrar checkout, pasarela ni pago automático. Un bloqueo en conflicto debe listar las citas afectadas solo al personal autorizado, sin cancelarlas silenciosamente.

## Notificaciones flotantes y bandeja

Agregar avisos en las sesiones de peluqueros y administrador: fondo negro, título dorado, contenido blanco, cierre y botón “Ver cita”. Propuesta: el peluquero ve sus citas asignadas, el administrador todas, cada uno en su bandeja con contador. El cliente no recibe estos flotantes de recordatorio. Cerrar el aviso no lo borra ni cancela la cita. Usar `aria-live="polite"`, no robar foco ni tapar acciones en móvil.

La presentación depende de que la web esté abierta; no solicitar permisos del sistema ni prometer avisos con el navegador cerrado. Consultar al cargar, recuperar conexión y volver a la pestaña, además de sincronización periódica. Cerrar suscripciones y limpiar avisos al salir de la cuenta. Detalles en [recordatorios](06-recordatorios.md).

## Dashboard de ventas

- Encabezado con período elegido, zona horaria y botón para actualizar.
- Selectores “Día”, “Semana”, “Mes” y “Rango personalizado”, con fechas visibles.
- Tarjetas: ventas cobradas, número de ventas y ticket promedio.
- Gráfico de ventas por día dentro del período; para un día puede mostrarse una sola barra, sin imponer desglose horario.
- Tabla: fecha de cobro, referencia, servicios, origen con/sin cita, profesional, total y estado.
- Detalle de ventas anuladas accesible al administrador, separado de los totales vigentes.

No cargar nombres de clientes en el dashboard si no son necesarios para la operación. No mostrar cifras ilustrativas como si fueran datos reales. Un error del servidor debe mostrar error, no un total cero.

## Adaptación responsive

- Diseñar primero para móvil; comprobar anchos de 360, 768 y 1280 píxeles como casos de referencia.
- En móvil usar agenda como lista por día y selector de fecha; evitar una cuadrícula semanal comprimida.
- Formularios de una columna en pantallas pequeñas, con resumen y acción principal visibles.
- En escritorio permitir navegación lateral, calendario semanal y panel de detalle.
- Las tablas pueden pasar a tarjetas o tener desplazamiento horizontal dentro de su contenedor, sin desbordar toda la página.
- No depender de hover; asegurar áreas táctiles cómodas, teclado adecuado para teléfono y formatos locales de fecha y moneda.

## Estados que cada pantalla debe contemplar

| Estado | Ejemplo |
| --- | --- |
| Cargando | “Consultando horarios…” sin permitir confirmar todavía. |
| Vacío | “No hay citas para este día”. |
| Sin disponibilidad | “No hay horarios disponibles. Prueba otra fecha”. |
| Configuración incompleta | “Las reservas en línea aún no están habilitadas”. |
| Conflicto | Horario ocupado durante la confirmación; volver a elegir. |
| Sesión vencida | Solicitar ingreso sin dar por guardada la operación. |
| Sin conexión / error | Conservar lo seguro y permitir reintento idempotente. |
| Éxito | Cita o venta con identificador obtenido del servidor. |

Usar etiquetas asociadas a los campos, resumen de errores y foco dirigido al primer error. Un calendario debe poder operarse sin ratón y contar con alternativa de selección de fecha y lista de horas. Las confirmaciones de anulación deben explicar el efecto sobre reportes antes de ejecutar la acción.
