# 15 — Reservas sin cuenta de cliente (v0.2)

Decisión confirmada por el usuario: **solo el administrador y los dos peluqueros tienen cuenta**. El cliente reserva libremente con **nombre, celular y correo obligatorios**, sin contraseña, inscripción en Auth ni usuario Auth anónimo. Este documento sustituye la propuesta anterior de acceso de clientes.

## Qué cambió

- Formulario: servicio → horario disponible → nombre/celular/correo → verificación de seguridad → confirmación.
- Supabase guarda la cita y su contacto en `customers`, pero no crea un usuario en `auth.users` para cada reserva. No tener cuenta no elimina la necesidad de guardar datos de la cita ni evita por sí solo el abuso.
- Los contactos se validan por formato; no se afirma que correo o celular estén verificados. Un número ecuatoriano `09XXXXXXXX` se normaliza a `+5939XXXXXXXX`; otros países requieren prefijo internacional.
- No se fusionan clientes por coincidencia de contacto ni se devuelve un historial al escribir un correo o teléfono. Una persona podría escribir datos de otra; no usar esos campos como autorización.
- Al confirmar se entrega un **enlace privado de esa reserva**, con token aleatorio de 256 bits. Su poseedor puede verla y cancelarla hasta 30 minutos antes. La base almacena solo el hash del token en esquema privado.
- El enlace usa el fragmento `#` de la URL para que el secreto no aparezca en las rutas HTTP ni en sus logs. Se envía al backend por cuerpo POST y nunca se incluye en ICS, evento Google, analítica o logs. No compartirlo. Válido hasta 30 días después del inicio reservado.
- El cliente debe guardar/copiar el enlace. **No hay envío automático por correo** ni recuperación automática por contacto; si se pierde, el personal verifica la solicitud por un procedimiento operativo todavía por definir.
- Para reintentos inciertos se conserva temporalmente en `sessionStorage` un identificador, token y hash de solicitud; no un usuario Auth ni contactos completos. Se elimina al confirmar. Tras reservar se recarga la página de gestión para descargar de memoria el script CAPTCHA externo.

## Protección y límites

La API Node `/api/public` valida entradas, tamaño, origen y límites. Antes de crear la reserva valida **Cloudflare Turnstile en el servidor**, incluyendo resultado, dominio y acción `booking`. Tener un token escrito en el navegador no basta. Los tokens de Turnstile caducan y son de un solo uso, según su [documentación de validación](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Los RPC de escritura/consulta privada y disponibilidad no son ejecutables con la clave pública. Solo el backend puede invocarlos con una clave privada de Supabase. Las operaciones del personal mantienen sesión, permisos y RLS.

Límites técnicos iniciales, revisables durante el piloto:

| Control | Valor inicial |
| --- | --- |
| Cuerpo JSON | 8 KiB |
| Intentos en una instancia, antes de llamar proveedores | 30 por minuto y origen de red |
| Intentos de reserva persistidos | 10 por 10 minutos y origen de red |
| Consultas de disponibilidad/gestión persistidas | 120 por 10 minutos y origen de red |
| Futuras reservas por celular o correo | 3; `business_settings.guest_max_upcoming` |
| Registro temporal de límites | Ventanas con expiración y limpieza; HMAC de IP, sin IP completa |

Los límites por contacto no demuestran identidad ni eliminan todos los ataques. CAPTCHA, disponibilidad transaccional y límites reducen abuso; se deben revisar en producción. Varias personas pueden compartir una IP. Sin configurar proxies confiables, el servidor aplica límites a la IP del proxy, una opción conservadora que puede limitar a todo el local. No confiar indiscriminadamente en `X-Forwarded-For`; configurar `TRUST_PROXY_CIDRS` solo después de verificar la red del hosting.

## Si ya ejecutaste los scripts anteriores

Ejecutar **solo la nueva migración** [202608310004_guest_booking.sql](../supabase/migrations/202608310004_guest_booking.sql) después de 001–003. No repetir migraciones ni borrar la base. Para un proyecto vacío, ejecutar 001, 002, 003 y 004 en ese orden.

La migración añade correo, acceso privado y límites; restringe los antiguos accesos de clientes y deshabilita reservas para revisar esta configuración. No borra usuarios existentes, citas ni ventas. Si llegaron a crearse cuentas de cliente con la versión anterior, quedan sin acceso a operaciones del negocio; revisar su retirada por separado, sin borrar registros históricos automáticamente.

## Configurar Supabase Auth: únicamente personal

1. Crear manualmente las tres cuentas en Authentication → Users y asignarlas con [01-assign-staff.sql](../supabase/setup/01-assign-staff.sql), como indica [13](13-puesta-en-marcha.md).
2. En la configuración de Auth, **desactivar “Allow new users to sign up”** y desactivar los inicios anónimos. Mantener el proveedor Email para que el personal existente pueda ingresar. Quitar el botón de registro por sí solo no bloquea la API de inscripciones. Referencia: [configuración general de Auth](https://supabase.com/docs/guides/auth/general-configuration).
3. No activar login social público para crear usuarios. La futura autorización Google Calendar es independiente de Supabase Auth.
4. Configurar URLs de retorno y recuperación de contraseña únicamente para el personal. SMTP puede ser necesario para recuperación del equipo; no se necesita confirmar correo para que un cliente reserve.

No se ha cambiado esta configuración en una cuenta remota; debe realizarla el responsable del proyecto.

## Variables del navegador y del servidor

Mantener las dos variables públicas en `.env.local`, sin secretos:

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Si todavía no existe, copiar [.env.server.example](../.env.server.example) a **`.env.server.local`**, archivo excluido de Git. Si ya existe, completar los campos faltantes sin sobrescribir claves existentes. Las variables `VITE_` de `.env.local` no sustituyen las siguientes:

```dotenv
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SECRET_KEY=CLAVE_PRIVADA_SOLO_SERVIDOR
PUBLIC_APP_ORIGIN=http://127.0.0.1:5173
TURNSTILE_SITE_KEY=CLAVE_PUBLICA_DEL_WIDGET
TURNSTILE_SECRET_KEY=CLAVE_PRIVADA_TURNSTILE
TRUST_PROXY_CIDRS=
```

La clave de Supabase puede ser `sb_secret_…` o la antigua `service_role`. **Nunca ponerla en `VITE_…`, el frontend, un documento, Git o el chat.** El backend la necesita para el nuevo gateway protegido; no se solicitan contraseña SQL ni credenciales bancarias. La clasificación oficial de claves está en [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

En Cloudflare Turnstile crear un widget para el dominio del aplicativo y copiar sus claves, siguiendo la [guía oficial](https://developers.cloudflare.com/turnstile/get-started/). Para desarrollo permitir el host local `127.0.0.1` si se usa la URL indicada arriba; separar pruebas de producción, como explica [Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). No desplegar claves de prueba que siempre aprueban desafíos. En producción, `PUBLIC_APP_ORIGIN` debe ser el origen HTTPS exacto, sin ruta final, y coincidir con el host admitido por Turnstile. La integración falla cerrada si falta configuración; no hay bypass productivo de CAPTCHA.

Después de completar las claves, detener la API con **Ctrl+C** y ejecutar de nuevo `.\scripts\npm-local.ps1 run dev:api` en PowerShell. Mantener abierta esa terminal y la de `run dev`; recargar Configuración. Se necesitan tanto la activación del negocio con jornadas válidas como la API configurada. No compartir las claves por chat.

No se ha creado un widget ni contratado servicios. Falta configurar y probar Turnstile real con el proyecto del usuario.

## Ejecutar

Terminal 1, interfaz:

```sh
npm run dev
```

Terminal 2, API local con variables privadas:

```sh
npm run dev:api
```

Vite escucha en `127.0.0.1:5173` y redirige `/api` a `127.0.0.1:3003`. API y proxy comparten [config/local-development.js](../config/local-development.js). El cliente nunca recibe las claves privadas. Una vista previa sin Supabase sigue permitiendo recorrer la interfaz sin guardar datos. La API debe permanecer en ejecución y tener conexión de red a Supabase; un mensaje de puerto ocupado requiere revisar ese proceso, no cambiar las claves ni cerrar otras aplicaciones indiscriminadamente.

Para producción:

```sh
npm ci
npm test
npm run build
npm start
```

El servidor Express sirve tanto `dist/` como la API. `npm run preview` por sí solo **no** es un entorno completo de reservas. Railway debe conservar el proceso Node y las variables privadas en tiempo de ejecución; variables Vite durante el build. Vercel requeriría adaptar el backend a su despliegue de funciones y un plan apropiado: no basta con subir `dist/`.

## Google Calendar

Guardar correo/celular/nombre mantiene los datos del reservante, pero **el correo no concede acceso a Google Calendar**. Después de reservar, el cliente podrá autorizar Google por OAuth sin abrir una cuenta en el aplicativo. El diseño liga el consentimiento a esa reserva usando su token y un estado OAuth temporal; no a una cuenta Auth de cliente. Referencia de permisos: [Google Calendar](https://developers.google.com/workspace/calendar/api/auth).

Esta entrega conserva descarga `.ics`; la sincronización automática sigue pendiente de código y configuración Google. La aplicación no crea eventos ni envía invitaciones al correo escrito sin autorización. El token privado nunca debe aparecer dentro del evento. Ver [12](12-google-calendar.md).

## Pruebas y pendientes

- 11 pruebas de JavaScript/API: formato de contactos, tokens privados, CAPTCHA rechazado, origen, fallo cerrado, límites y ausencia de precio/rol controlados por el cliente.
- 20 comprobaciones SQL locales: 14 de la base anterior y 6 de actualización, reserva invitada sin Auth, permisos, contacto/IP, cancelación y concurrencia. La cantidad de usuarios Auth no crece al reservar.
- Los adaptadores externos de las pruebas HTTP son simulados; no se verificó CAPTCHA real, correo, OAuth, proxy de hosting ni Supabase remoto.
- Antes del piloto: completar privacidad, conservar solo contactos necesarios, definir retención y procedimiento ante enlace perdido, probar con personal real y reactivar `booking_enabled` desde administración.
