# 14 — Estado real de la implementación

Versión 0.2.0 — 31 de agosto de 2026. El código está publicado en GitHub, pero la aplicación todavía no tiene un despliegue público ni representa un piloto aprobado por el dueño.

## Implementado en código

| Área | Entrega inicial |
| --- | --- |
| Interfaz | HTML semántico, Tailwind 4, JavaScript modular y Vite. Negro, dorado y blanco; reserva por pasos, resumen, pantallas de acceso y panel del personal. |
| Vista previa | Sin claves permite recorrer pantallas; no inventa horarios, citas, usuarios ni ventas, ni guarda operaciones en el navegador. |
| Acceso | Auth con correo/contraseña y recuperación solo para administrador/peluqueros. Invitados sin cuenta, con nombre/celular/correo y enlace privado de la reserva. |
| Reservas | Consulta por día/profesional/servicio y confirmación mediante función SQL. Ocupación compartida por citas y descansos, restricción GiST e idempotencia. |
| Políticas | Cancelación hasta 30 minutos antes; llegada separada de inicio; inasistencia después de 5 minutos sin llegada. Mensaje de llegar 5 minutos antes. |
| Personal | Agenda del día, registro de llegada/inicio/finalización y reprogramación autorizada con revisión de versión. |
| Descansos | Peluquero sobre su agenda y administrador sobre cualquiera. Crear/retirar; rechaza cruces, mantiene motivo privado. |
| Sin cita | Atención inmediata si cabe; registro de atención anterior con motivo sin ocupar retrospectivamente la agenda. |
| Cobros | Administrador registra dinero recibido por efectivo, transferencia o Deuna. Cálculo y precios históricos del servidor; no pasarela de pago. |
| Ventas | Día, semana, mes y fechas inclusivas; totales de ventas cobradas, serie diaria y detalle. Anulación auditada sin borrar registros ni devolver dinero. |
| Recordatorios | Programados a 10 minutos, administrador y peluquero asignado; consulta cada 20 s con web visible, reclamación de presentación, bandeja de vigentes y lectura/cierre independientes. |
| Base | Cuatro migraciones, RLS y funciones SQL con permisos explícitos; roles del personal por instalación controlada. |
| Operación | Servidor Express para el build, API pública protegida por CAPTCHA/límites y ruta `/health`. Script Supabase Cron para ausencias. No se activó Cron remotamente. |
| Calendario | Descarga `.ics`, identificada como copia manual sin actualizaciones. **Sincronización Google no implementada.** |

## Límites deliberados de esta primera versión

- El proyecto Supabase del negocio está conectado, el personal fue creado y la consulta de horarios fue verificada. Falta comprobar una reserva pública completa con CAPTCHA y validar SMTP, Cron y el ciclo operativo completo.
- Reserva online sin cuenta confirmada por el usuario. CAPTCHA real y gateway privado deben configurarse. No hay usuarios Auth anónimos, búsqueda de historial por contacto ni envío automático del enlace por correo.
- Solo el administrador cobra y ve reportes. El dueño debe confirmar estos permisos.
- Bloques iniciales 45/50/50/60 min, margen 0, paso 5 min, horizonte 30 días y anticipación 0 son decisiones técnicas revisables. La base limita inicialmente a 3 futuras citas confirmadas/presentes por celular o correo para invitados, llegada desde 60 min antes y registros retrospectivos hasta 365 días. Estos límites de protección están en SQL; no presentarlos como acuerdos confirmados.
- La reprogramación inicial está disponible al personal antes del plazo de cancelación, sobre el mismo peluquero y servicio, conservando duración y precio reservados. Las excepciones administrativas y el cambio de profesional quedan pendientes de acuerdo e implementación.
- Registrar llegada antes de la cita está permitido. Iniciar corte anticipadamente no está habilitado; iniciar con retraso requiere espacio para la duración completa y no desplaza al siguiente cliente. Esta política conservadora debe validarse en el piloto.
- Finalizar antes no libera automáticamente el resto del bloque reservado. Evita ofertar huecos inciertos; el comportamiento se revisará con el dueño.
- Una jornada por día y profesional; almuerzos mediante descansos. Para feriados, usar bloqueos de día completo por profesional. No hay editor de excepciones recurrentes ni catálogo completo con alta/baja de servicios desde UI; tarifas, duración y margen sí se editan.
- Apertura general se configura mediante `business_hours` en SQL; las jornadas individuales se editan desde administración. No ejecutar cambios de horarios generales sobre reservas futuras sin revisión de impacto.
- Agenda/mis citas recupera hasta 250 registros. El dashboard calcula todo el rango, hasta 367 días inclusivos; el detalle muestra hasta 500 ventas con aviso cuando hay más. Reducir el rango para revisar las restantes. Paginación/exportación quedan pendientes.
- No se procesan descuentos, propinas, facturación fiscal, devoluciones electrónicas, cierres de caja ni sustitución automática de una venta anulada. La anulación no borra la atención ni permite cobrarla dos veces.
- La fecha de un cobro retrospectivo es la fecha declarada del dinero recibido; no se mide la duración real de un corte retrospectivo.
- Sin Web Push ni alertas con la web cerrada. La presentación puede demorarse por red o pestaña suspendida; no se garantiza precisión de segundos. Un toast invalidado se retira en la siguiente consulta; fallos de confirmación pueden ocasionar repetición recuperable.
- Bandeja inicial de avisos vigentes, sin historial navegable, contador ni enlace directo a la cita. Realtime es una ampliación, no una dependencia instalada.
- Privacidad provisional: faltan responsable/contacto, retención, textos definitivos y controles operativos antes de publicar. Logotipo original/fotos aún pendientes; la marca de corona actual es un recurso SVG provisional.
- No hay OAuth Calendar, cifrado de refresh tokens ni cola de sincronización implementados. Ver [12](12-google-calendar.md); `.ics` no satisface ese requisito.
- El código está publicado en la rama `main` de GitHub. No se ha creado el servicio Railway ni desplegado un dominio público.

## Contrato de esta versión frente al diseño documental

Los documentos 01–12 describen el alcance objetivo. Para ejecutar código, los contratos efectivos son las migraciones y `src/services/api.js` / `src/main.js`.

- `calendar_allocations` unifica citas/descansos con exclusión por profesional e intervalo `[inicio, fin)`.
- `visits` representa atenciones; `sales` y `sale_items` contienen cobros y copias de precios.
- Estados de aviso `active` boolean y `presented_at` sustituyen los nombres conceptuales `status` y `first_presented_at`. Hay un solo tipo de recordatorio a 10 minutos, por eso la clave única se reduce a destinatario/cita/versión.
- `private.requests` guarda idempotencia; `private` no debe exponerse en PostgREST. Las mutaciones públicas invocan validaciones internas y no conceden escritura directa a las tablas.
- Los RPC reales están en las migraciones 002 y 004. Express sirve archivos y `/api/public`; usa credenciales privadas para las operaciones de invitados. Los cobros del personal mantienen RPC con Auth. El cliente nunca recibe claves privadas.
- No hay tablas de OAuth/calendarios, excepciones recurrentes o políticas ampliadas que todavía no tengan consumidor real.

## Verificaciones realizadas

- Compilación de producción con Vite y Node 24.19.
- Servidor Express verificado por HTTP: `/health`, recargas de rutas SPA, recursos inexistentes 404 y cabeceras. Se ejecutó fuera del aislamiento de red local después de que este interfiriera con las solicitudes de prueba.
- 17 pruebas JavaScript/HTTP: fechas, cancelación, escape e ICS, contacto, tokens, validación CAPTCHA, normalización y rechazo de orígenes, fallos cerrados, límites y contrato del gateway. Adaptadores externos simulados.
- Migraciones ejecutadas en PostgreSQL 14.15 local, dentro de una instancia temporal aislada. 20 comprobaciones SQL aprobadas (14 de la base anterior y 6 del nuevo flujo sin cuenta): permisos/RLS, concurrencia de reservas, intervalos, idempotencia, descansos, cancelación, reprogramación, atención sin cita, ausencia, destinatarios y reclamación de avisos, cobros y reportes.
- Navegación de vista previa inspeccionada en el navegador: reservas, agenda y ventas; selección de servicios y bloqueo de guardado sin Supabase. Revisiones de ancho móvil y escritorio sin desbordamiento general; consola sin errores en esos recorridos.

Las pruebas de SQL simulan `auth.users` y `auth.uid()` para probar los roles con `SET ROLE`; no simulan una prueba integral de Supabase Auth/PostgREST. La entrega no afirma que se hayan probado correos reales, Google Calendar, Cron remoto, sesiones multiusuario en producción ni todos los criterios del documento 07.

Ejecutar pruebas:

```sh
npm test
npm run test:db
npm run build
npm run test:server
```

`test:db` requiere binarios PostgreSQL accesibles mediante `PG_BIN` o el valor predeterminado de Windows `C:/Program Files/PostgreSQL/14/bin`. El script crea una instancia propia en `.test-db/`, escucha solo en `127.0.0.1` y la detiene al terminar. No acepta URL de bases remotas. Usa datos ficticios y deja artefactos ignorados por Git para diagnóstico. No ejecutarlo como root en Linux; Windows puede necesitar permiso para iniciar procesos locales.

## Siguiente entrega

Crear el servicio Railway desde la rama `main`, cargar sus variables protegidas, establecer el dominio en `PUBLIC_APP_ORIGIN` y probar desde ese dominio reserva → llegada → corte → cobro con cuentas controladas. También siguen pendientes privacidad, OAuth Calendar y la validación operativa con el dueño.
