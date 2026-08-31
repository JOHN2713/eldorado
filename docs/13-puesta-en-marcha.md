# 13 — Puesta en marcha de El Dorado

Fecha: 31 de agosto de 2026. Versión 0.2.0, clientes sin cuenta. Ver también [15 — Actualización](15-reservas-sin-cuenta.md). Esta guía describe acciones que todavía debe realizar el responsable del proyecto. No se ha creado ni modificado un proyecto Supabase remoto.

## 1. Crear el proyecto Supabase

Crear un proyecto **nuevo y dedicado a El Dorado** desde el [panel de Supabase](https://supabase.com/dashboard). Elegir organización y región disponibles; conservar la contraseña de la base en un gestor de contraseñas. No enviarla por chat ni escribirla en Git.

Para comenzar, usar datos de prueba y mantener las reservas deshabilitadas. La base del negocio vive en Supabase, no en el ordenador que sirve la página ni en Railway.

## 2. Ejecutar cuatro migraciones, en orden

En **SQL Editor**, abrir una consulta, pegar el contenido completo de cada archivo y ejecutar. Ejecutar uno por uno, solo cuando el anterior termine correctamente:

| Orden | Archivo | Qué instala |
| --- | --- | --- |
| 1 | [202608310001_schema.sql](../supabase/migrations/202608310001_schema.sql) | Tablas, restricciones de ocupación, auditoría, trigger de clientes y permisos RLS. |
| 2 | [202608310002_operations.sql](../supabase/migrations/202608310002_operations.sql) | Operaciones de reservas, descansos, atención, cobros, reportes y recordatorios. |
| 3 | [202608310003_business.sql](../supabase/migrations/202608310003_business.sql) | El Dorado, dirección, USD, apertura 09:00–21:00 todos los días, servicios/precios y dos profesionales sin habilitar. |
| 4 | [202608310004_guest_booking.sql](../supabase/migrations/202608310004_guest_booking.sql) | Reserva sin cuenta, correo del cliente, enlaces privados y límites; restringe los accesos anteriores. |

Si ya se instalaron 001–003, ejecutar **solo 004**. No reinstalar ni borrar la base. Para instalación inicial, se ejecutan una sola vez en un proyecto vacío, como propietario desde el SQL Editor. Cada migración tiene su transacción. Si falla, guardar el error sin credenciales y corregir antes de continuar; no borrar tablas ni volver a ejecutar migraciones ya aplicadas. No ejecutar los scripts locales de prueba dentro del SQL Editor.

Comprobación de lectura después de la migración 004:

```sql
select public.get_bootstrap();
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

`booking_enabled` debe ser `false`. Es normal que la lista pública de peluqueros esté vacía al principio. No desactivar RLS para resolver un error. Mantener `private` fuera de los esquemas expuestos por la Data API.

## 3. Crear las cuentas iniciales del personal

En **Authentication → Users**, crear las cuentas reales del administrador y de los dos peluqueros. Usar tres correos distintos, contraseñas seguras y cuentas verificadas. Cada persona debe conservar su propio acceso; no compartir la cuenta administrativa.

Abrir [01-assign-staff.sql](../supabase/setup/01-assign-staff.sql). Editar **la copia en el SQL Editor**, sin guardar correos reales en el repositorio:

- `admin_email`: correo del administrador.
- `barber_one_email` y `barber_two_email`: correos exactos creados en Auth.
- `barber_one_name` y `barber_two_name`: nombres que verá el cliente.
- `barber_one_services` y `barber_two_services`: servicios que realmente realiza cada uno.

Identificadores de los servicios:

| Servicio | UUID |
| --- | --- |
| Corte normal | `10000000-0000-0000-0000-000000000001` |
| Corte con diseño | `10000000-0000-0000-0000-000000000002` |
| Corte con barba | `10000000-0000-0000-0000-000000000003` |
| Corte completo | `10000000-0000-0000-0000-000000000004` |

Ejemplo **solo si ese peluquero realiza los cuatro servicios**:

```sql
barber_one_services uuid[] := array[
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
]::uuid[];
```

Completar también el segundo arreglo. Ejecutar el archivo completo una vez. No usar este script como herramienta de sustitución de empleados cuando ya existan citas; los cambios posteriores requieren revisar asignaciones y notificaciones.

El script asigna los roles iniciales mediante SQL controlado. No hay registro público de cuentas: el cliente reserva sin Auth y todas las cuentas del equipo se crean administrativamente.

Para agregar posteriormente otro administrador, mantener el dominio `/ingresar` en las URLs permitidas de Supabase y ejecutar desde un entorno confiable:

```powershell
$env:ADMIN_REDIRECT_ORIGIN='https://DOMINIO_PUBLICO'
.\scripts\npm-local.ps1 run staff:invite-admin -- NUEVO_ADMIN@example.com --invite
```

El script usa la clave privada de `.env.server.local`, envía una invitación, rechaza usuarios vinculados como peluqueros y activa `user_roles.role='admin'`. No guardar el correo real en Git. La persona invitada abre el enlace, establece su contraseña y entra directamente al panel. Si la invitación vence, se puede ejecutar nuevamente solo después de revisar el usuario en Authentication → Users.

## 4. Configurar autenticación

Supabase Auth se usa exclusivamente para los administradores y los dos peluqueros, con correo y contraseña. Los clientes no crean cuentas ni reciben correo de verificación para reservar.

- Desactivar **Allow new users to sign up** y los inicios de sesión anónimos; mantener Email para ingresar con las cuentas del personal ya creadas. Ver [configuración de Auth](https://supabase.com/docs/guides/auth/general-configuration).
- Configurar **Site URL** local: `http://127.0.0.1:5173`.
- Añadir `http://127.0.0.1:5173/ingresar` a las URLs de retorno permitidas.
- Si se usa `localhost` en vez de `127.0.0.1`, añadir también esa URL exacta. No mezclar dominios durante el mismo flujo.
- Al publicar, sustituir Site URL por el dominio HTTPS real y permitir su ruta `/ingresar`. Evitar comodines amplios en producción.
- Configurar SMTP para los correos de recuperación del personal. El envío predeterminado de Supabase está limitado y no sirve como envío público de producción; consultar la [guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Estos correos sirven para acceso a cuentas. **Los recordatorios de citas siguen siendo flotantes internos**, sin correo ni WhatsApp.

## 5. Colocar URL y clave pública

Buscar la **Project URL** y la **publishable key** del proyecto en su panel de conexión/configuración API. La clave pública suele comenzar por `sb_publishable_`. También se admite la antigua clave `anon` si el proyecto aún la utiliza. Los tipos y ubicaciones se describen en [API keys de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

En la raíz del proyecto, copiar `.env.example` a `.env.local` y completar:

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

En PowerShell, solo si `.env.local` todavía no existe:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.local
```

**No colocar `service_role`, `sb_secret_…`, contraseña de la base ni secretos Google en variables `VITE_…`.** Las variables Vite se incluyen en el JavaScript descargado por el navegador. La protección de los datos depende de Auth, los permisos y RLS; la clave pública no concede permisos administrativos. La v0.2 sí necesita una clave privada **solo en el backend**, separada en `.env.server.local`; no compartirla en chat. Configurar también Turnstile como indica [15](15-reservas-sin-cuenta.md).

`.env.local` está excluido de Git. Reiniciar el servidor de desarrollo después de modificarlo. Para producción, definir las dos variables en el hosting **antes de compilar**; cambiarlas exige un build nuevo.

**Si el acceso del equipo pide configurar Supabase:** comprobar que estas dos variables están en **`.env.local`**, junto a `package.json`. Ponerlas únicamente en `.env.server.local` no configura la página. El ingreso del administrador usa la URL y clave pública del frontend; no requiere la clave privada ni Turnstile. La clave privada y el CAPTCHA son necesarios para las reservas públicas sin cuenta. Si se corrige el archivo, recargar la página y, si el aviso persiste, reiniciar `run dev`. No volver a crear las cuentas por este aviso.

Para el backend, copiar `.env.server.example` a `.env.server.local` y completar `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PUBLIC_APP_ORIGIN`, `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`. Ninguna clave privada lleva prefijo `VITE_`. Instrucciones completas y límites: [15](15-reservas-sin-cuenta.md).

## 6. Iniciar la aplicación

Instalar Node.js 24 LTS, abrir terminal en la carpeta del proyecto y ejecutar:

```sh
npm ci
npm run dev
```

En otra terminal ejecutar `npm run dev:api` para la API local. Vite redirige `/api` al puerto **3003**. Ambos toman el puerto de [config/local-development.js](../config/local-development.js), para evitar destinos distintos. Ambas terminales deben permanecer abiertas durante desarrollo. El puerto 3001 estaba ocupado por VS Code en este equipo; no cerrar VS Code para iniciar la API. No dejar una segunda API antigua en otro puerto.

El arranque correcto anuncia `El Dorado listo en http://127.0.0.1:3003 (API local)` y mantiene la terminal ocupada. Si el puerto ya está ocupado, la API informa el error y termina con código 1; no debe anunciar éxito. La aplicación distingue una API inaccesible de una API que responde con configuración incompleta. Consultar `http://127.0.0.1:5173/api/public/config` debe devolver JSON con `ready: true` cuando están cargados los parámetros. Esto no prueba todavía la validez de las claves ni una reserva completa. Si se inicia desde un entorno restringido, permitir a ese proceso comunicarse con Supabase; tener variables cargadas no garantiza conectividad.

Abrir `http://127.0.0.1:5173`. La franja de vista previa desaparece al reconocer la configuración. Si la URL/clave son válidas pero faltan migraciones, se muestra un error de conexión; no se sustituye silenciosamente por datos ficticios.

### Windows: Node antiguo o archivo bloqueado durante `npm ci`

Node 22.11 no cumple el mínimo del proyecto (`>=22.12.0`). En este ordenador también está disponible Node 24.19; el auxiliar [npm-local.ps1](../scripts/npm-local.ps1) permite usarlo sin modificar la instalación global. Prefiere el Node instalado si ya es compatible y, en caso contrario, busca ese runtime local. Si no existe, pide instalar Node compatible; no descarga ni instala programas.

Desde la raíz del proyecto, en PowerShell:

```powershell
.\scripts\npm-local.ps1 ci
.\scripts\npm-local.ps1 run dev
```

En una segunda terminal:

```powershell
.\scripts\npm-local.ps1 run dev:api
```

El auxiliar ejecuta npm y sus procesos con el mismo Node compatible y restaura el entorno de la terminal al finalizar. Se puede usar también con `test` o `run build`. Una vez actualizada la instalación global de Node y reabierta la terminal, se pueden usar los comandos normales `npm ...`.

Si `npm ci` muestra **`EPERM unlink` sobre `lightningcss…node`**, detener primero la vista previa/Vite de este proyecto con **Ctrl+C** en su terminal; detener también su API antes de reinstalar. Windows no puede reemplazar una biblioteca cargada por un proceso. Ejecutar `ci` con los servidores detenidos y arrancarlos solo después. No hace falta borrar `package-lock.json`, desactivar el antivirus ni cerrar procesos de otros proyectos. El 31 de agosto se detuvo la vista previa que había quedado abierta y se reinstalaron correctamente las dependencias con Node 24, sin cambiar claves ni la base remota.

## 7. Completar jornadas y activar las reservas

Ingresar con la cuenta administrativa y abrir **Panel del negocio → Configuración**:

1. Revisar dirección y zona `America/Guayaquil`.
2. Confirmar los precios y tiempos bloqueados de 45/50/50/60 minutos. El margen inicial es 0 y puede ajustarse por servicio.
3. Definir los días y horas reales de trabajo de **cada peluquero**. El negocio abre 12 horas, pero no se presume que ambos trabajen toda esa jornada.
4. Revisar cuadrícula inicial de 5 minutos, horizonte de 30 días y anticipación mínima inicial de 0 minutos. Son valores técnicos iniciales, no nuevos acuerdos del dueño.
5. Registrar almuerzos/salidas en **Descansos**. Un bloqueo no cancela reservas ya existentes: si se cruza, la operación se rechaza.
6. Activar reservas cuando las jornadas, servicios y nombres estén revisados. La base no permite habilitarlas si falta la configuración mínima del equipo.

Si aparece **«Falta completar el equipo»**, revisar **«Qué falta para activar las reservas»** al inicio de Configuración. El resumen usa los datos guardados de cada peluquero. En **Equipo y jornadas**, marcar **Profesional activo** y las casillas de los días que realmente trabaja, revisar las horas y pulsar **Guardar jornada** para cada uno. Las horas visibles en un día desmarcado no habilitan ese día. Si el aviso indica que no tiene servicios asignados, revisar las asignaciones del script de personal: guardar los precios del catálogo no asigna servicios a un peluquero. No retirar la validación ni activar reservas con un `UPDATE` directo para saltarla.

Con ambos peluqueros completos, volver arriba, marcar **Habilitar reservas reales** y pulsar **Guardar configuración**. También debe estar lista la API de reservas sin cuenta: la sesión administrativa por sí sola no la configura. El panel indica este segundo requisito por separado. Completar el archivo del servidor como indica [15](15-reservas-sin-cuenta.md), reiniciar la API y recargar Configuración. El estado «configuración cargada» solo confirma presencia de parámetros; probar después CAPTCHA y reserva completa durante el piloto.

Primero realizar un piloto controlado con cuentas de prueba. No habilitar atención pública hasta completar privacidad, acceso, correos y verificación de las reglas con el negocio.

## 8. Activar anulación por inasistencia

Habilitar **Cron / `pg_cron`** en Supabase y ejecutar [02-enable-expiration.sql](../supabase/setup/02-enable-expiration.sql) después de las migraciones. Referencia: [instalar Supabase Cron](https://supabase.com/docs/guides/cron/install).

El trabajo `eldorado-expire-no-shows` se ejecuta cada minuto, aunque la página esté cerrada. Marca `no_show` solo a reservas confirmadas sin llegada registrada cuyo límite de 5 minutos ya terminó. La escritura periódica puede demorarse hasta el siguiente ciclo; las operaciones de disponibilidad también normalizan vencimientos y el registro de llegada comprueba el límite usando el reloj de la base.

Verificar en SQL Editor que el trabajo esté activo y revisar sus ejecuciones:

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'eldorado-expire-no-shows';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'eldorado-expire-no-shows')
order by start_time desc limit 10;
```

No exponer `cron` ni `private` por la API. Este trabajo no envía los recordatorios: los flotantes consultan las notificaciones vigentes desde la web abierta.

## 9. Verificación antes del piloto

- Reservar sin cuenta, completando nombre/celular/correo y CAPTCHA. Comprobar que Auth contiene únicamente las cuentas autorizadas del personal.
- Intentar el mismo horario y peluquero desde dos navegadores sin sesión: solo una reserva debe confirmarse. Probar el enlace privado y comprobar que un correo/celular no permiten consultar citas.
- Probar descansos, límite de cancelación y llegada/ausencia en horarios controlados.
- Revisar un recordatorio 10 minutos antes con las sesiones del administrador y del peluquero asignado; el otro peluquero no debe recibirlo.
- Registrar atención sin cita, finalizarla y cobrarla desde administración. Comprobar importe y período en ventas.
- Confirmar que `Cron` ejecuta y que los correos de acceso llegan a cuentas ajenas al equipo de Supabase.
- Verificar móvil, enlace privado del cliente y recarga de rutas; cierre de sesión y recuperación de contraseña solo para el personal.

Google Calendar automático sigue pendiente de implementación OAuth. La descarga `.ics` es una copia manual y no se actualiza al cancelar/reprogramar. No ofrecerla como sincronización.

## 10. Publicación posterior

Esta entrega no hace push ni despliega. El siguiente paso será verificar el contenido/acceso de `JOHN2713/eldorado`, integrar sin sobrescribir archivos ajenos y configurar Railway. Ya existen `npm run build`, `npm start` y `/health`.

Ejecutar `npm ci`, `npm test`, `npm run build`; servir `dist/` con `npm start`. Railway debe aportar `PORT` y las variables públicas durante la construcción. Ver [08 — Repositorio y despliegue](08-repositorio-y-despliegue.md). No usar Vercel gratuito para este negocio sin volver a verificar las condiciones de uso comercial del plan.
