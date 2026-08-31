# 08 — Repositorio y despliegue futuro

Estado: guía de preparación, actualizada el 31 de agosto de 2026. La rama `main` está publicada en [JOHN2713/eldorado](https://github.com/JOHN2713/eldorado). El proyecto Supabase del negocio está conectado y la consulta de horarios fue verificada. No se ha accedido a Railway ni publicado la aplicación en un dominio; también falta comprobar una reserva pública completa con CAPTCHA.

## Destino propuesto

**Railway para la interfaz y API pública Node; Supabase para la base de datos, Auth exclusivo del personal y recordatorios.** La v0.2 necesita un servidor para CAPTCHA, límites y acceso a reservas sin cuenta; ya no basta con alojar archivos estáticos. Esta separación permite cambiar el alojamiento del frontend sin mover los datos del negocio.

| Opción | Evaluación para este proyecto |
| --- | --- |
| Railway con la suscripción existente | Opción principal propuesta; comprobar plan, consumo y configuración disponible. |
| Vercel con plan apto para uso comercial | Alternativa técnica si se elige y se acepta su coste. |
| Vercel Hobby gratuito | No usar como propuesta de producción comercial: su documentación lo limita a uso personal no comercial. |

La restricción de Hobby está indicada en la [documentación oficial de Vercel](https://vercel.com/docs/plans/hobby). No asumir que la aplicación deja de ser comercial por ser pequeña o no cobrar reservas en línea. Verificar nuevamente las condiciones al desplegar.

Railway admite alojamiento de sitios estáticos desde un repositorio. Su facturación contempla suscripción y consumo de recursos; tener una suscripción no demuestra que este proyecto tenga coste incremental cero. Fuentes: [guía de sitios estáticos](https://docs.railway.com/guides/static-hosting) y [preguntas de precios](https://docs.railway.com/pricing/faqs). No se ha calculado un presupuesto real.

## Preparar el repositorio

1. Usar como destino GitHub `JOHN2713/eldorado`; la rama `main` se publicó el 31 de agosto de 2026. Revisar colaboradores y visibilidad desde GitHub sin incluirlos en archivos del proyecto.
2. Incluir documentación, código, archivo de dependencias bloqueadas, migraciones y pruebas.
3. Crear `.gitignore` antes de agregar archivos: excluir `.env`, variantes con secretos, `node_modules/`, `dist/`, logs y respaldos/exportaciones de clientes. Permitir `.env.example` sin valores reales.
4. Revisar el contenido que se va a publicar y ejecutar una comprobación de secretos. Si alguna clave se expuso, rotarla; borrar el archivo del último commit no basta.
5. Propuesta de trabajo: rama principal estable y ramas pequeñas por funcionalidad, con revisión de cambios.
6. Automatizar al menos instalación reproducible, pruebas críticas y build antes de integrar.

No subir credenciales de Supabase, documentos con clientes reales ni copias de la base de datos al repositorio. Los recordatorios internos no requieren claves de mensajería.

## Entornos

| Entorno | Datos | Notificaciones internas | Finalidad |
| --- | --- | --- | --- |
| Desarrollo | Ficticios | Usuarios de prueba | Crear y probar módulos. |
| Pruebas / staging | Ficticios o anonimizados con autorización | Destinatarios controlados | Validación del dueño y pruebas de despliegue. |
| Producción | Del negocio | Flotantes para destinatarios aprobados | Operación real. |

Separar proyectos o instancias de Supabase según presupuesto; si no se puede disponer de staging remoto, mantener pruebas locales aisladas. Una preview del frontend no debe usar por accidente la base ni las notificaciones de producción.

## Supabase

- Crear proyecto dedicado y escoger región tras conocer dónde operará el local.
- Aplicar migraciones versionadas y comprobar restricciones, RLS y permisos de ejecución.
- Configurar el método de autenticación, remitente si aplica y URLs de retorno explícitas para cada entorno.
- Crear administrador inicial por procedimiento controlado, nunca mediante un botón público de cambio de rol.
- Registrar precios/rangos, USD, dirección, apertura y políticas confirmadas. Validar bloques propuestos, margen, cuadrícula y jornadas individuales antes de habilitar reservas.
- Instalar funciones del servidor y configurar secretos fuera de Git.
- Configurar tablas, permisos y consultas de notificaciones para peluqueros y administrador, y Realtime si se usa. Los flotantes no requieren proveedor externo ni Cron de envío.
- Configurar Cron para inasistencias: normalizar vencidas sin llegada aunque la web esté cerrada. Propuesta de ejecución cada minuto; la API aplica el plazo efectivo independientemente del retraso del proceso.
- Configurar funciones OAuth y procesador de Google Calendar con secretos protegidos; habilitar tareas solo en el entorno correcto y usar cuentas de prueba en staging.
- Revisar capacidad, límites, respaldo y recuperación del plan elegido antes de abrir al público.

## Railway

1. Crear un servicio desde el repositorio `JOHN2713/eldorado` y seleccionar la rama `main`.
2. Mantener Node 24, compatible con el requisito declarado en `package.json` y `.nvmrc`.
3. Railway puede detectar los scripts del proyecto. La instalación reproducible es `npm ci`, la compilación `npm run build` y el inicio `npm start`.
4. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para el build; configurar además `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` solo como variables del servicio. Nunca copiar los archivos `.env*.local` al repositorio.
5. Generar el dominio HTTPS de Railway, establecer esa URL exacta en `PUBLIC_APP_ORIGIN` y volver a desplegar. El servidor sirve `dist/` y `/api/public`, escucha en `0.0.0.0` y `PORT`. Mantener `TRUST_PROXY_CIDRS` vacío hasta confirmar los proxies que deban considerarse confiables; ver [15](15-reservas-sin-cuenta.md).
6. Si la navegación usa rutas del cliente, configurar el fallback hacia `index.html` sin ocultar errores de recursos inexistentes. Comprobar recargas de `/reservar` y `/panel/agenda`.
7. Configurar dominio y HTTPS; actualizar URL base y callbacks de autenticación.
8. Comprobar interfaz, login, reserva concurrente, cobro, reportes y recordatorios desde el dominio final.
9. Revisar alertas y consumo del servicio tras el despliegue.

Ya están disponibles `npm run build` y `npm start`: Express sirve `dist/`, escucha en `PORT` y ofrece `/health`. El repositorio también ejecuta instalación, control de secretos, pruebas, build y prueba del servidor mediante GitHub Actions. Falta crear el servicio Railway, cargar sus variables y verificar el dominio final.

## Alternativa Vercel

Con un plan adecuado, adaptar también el backend público a funciones Vercel; el build estático por sí solo no soporta reservas sin cuenta. Configurar variables privadas y públicas, rutas y dominio. Mantener Supabase para persistencia/autorización, Cron de inasistencias y procesador Google; los flotantes se presentan en el frontend. No se necesita scheduler del hosting del frontend y no se deben asumir límites sin verificarlos al elegir el plan.

## Google Calendar y procesos en servidor

La sincronización solicitada requiere proyecto Google Cloud, Calendar API habilitada, cliente OAuth, pantalla de consentimiento, URLs de retorno y revisión de permisos/publicación. Guardar secretos y tokens cifrados fuera de Git y de variables públicas. Las URLs de prueba y producción deben estar separadas. Configuración y límites en [Google Calendar](12-google-calendar.md).

Probar con cuentas controladas crear, modificar y retirar eventos propios de la app; denegar OAuth debe dejar la reserva intacta. No conectar calendarios de clientes reales en pruebas ni confundir login Google con permiso de calendario. No dar por entregada la sincronización si solo se implementó un archivo de importación.

Monitorizar última ejecución y errores del proceso de inasistencias, trabajos Google pendientes y credenciales revocadas. Tras una interrupción, procesar vencimientos y reconciliar con el estado actual de cada cita antes de reenviar trabajos viejos. Los pagos directos no requieren credenciales bancarias ni API de Deuna.

## Publicación, recuperación y seguimiento

- Identificar versión del frontend y versión de migraciones publicadas.
- Desplegar primero cambios de datos compatibles y luego la interfaz que los usa.
- Mantener una versión anterior utilizable del frontend. Revertir frontend no revierte automáticamente la base de datos.
- Ante fallo, deshabilitar reservas nuevas si existe riesgo de inconsistencia; conservar datos y diagnosticar con logs sanitizados.
- Definir responsable de respaldos, frecuencia, retención y prueba de restauración según el plan contratado.
- Registrar responsables de dominio, cuentas, OAuth, procesos de inasistencia, incidentes de sincronización y revisión de consumo.

Presupuesto y límites a confirmar: hosting, Supabase, dominio, autenticación si aplica, configuración/uso de Google Calendar y respaldos. No se contempla proveedor de mensajería para flotantes ni pasarela de pagos. La publicación en GitHub ya se realizó; Railway, dominio y calendarios siguen pendientes.

### Publicación inicial en GitHub — 31 de agosto de 2026

- Se inicializó la rama `main` y se publicó el código en `JOHN2713/eldorado`.
- Se comprobaron 54 archivos publicables. `.env.local`, `.env.server.local`, `node_modules/` y `dist/` quedaron excluidos por `.gitignore`.
- `npm run check:publish` no detectó archivos de entorno ni patrones de claves privadas.
- Antes del primer push aprobaron 16 pruebas, el build de producción y la prueba HTTP del servidor.
- Se añadió GitHub Actions para repetir instalación, control de publicación, pruebas, build y prueba del servidor en cada push o pull request a `main`.
