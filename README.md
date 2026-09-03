# El Dorado Barbería — Agenda y ventas

**Estado:** primera versión desplegada en Railway y conectada al proyecto Supabase del negocio. OAuth Google pendiente.<br>
**Versión de aplicación:** 0.3.0 · **Versión documental:** 0.6 — 3 de septiembre de 2026.<br>
**Repositorio:** [JOHN2713/eldorado](https://github.com/JOHN2713/eldorado), rama `main` publicada el 31 de agosto de 2026.

Este proyecto permite reservar turnos, recordar citas, registrar servicios realizados con o sin reserva y consultar las ventas de la peluquería. La interfaz, el servidor y las operaciones SQL están implementados. El proyecto Supabase del negocio ya fue configurado y la aplicación está publicada en [Railway](https://eldorado-production-d510.up.railway.app). Se verificaron `/health` y la consulta pública de horarios; falta comprobar una reserva completa con CAPTCHA.

**Flujo confirmado:** los clientes reservan sin cuenta, indicando nombre, celular y correo. Solo el personal creado por un administrador usa Supabase Auth. La gestión del cliente es por enlace privado de cada reserva. El equipo inicial mantiene dos administradores y dos agendas de peluquero; una cuenta administradora también puede estar vinculada a una agenda profesional. Ver [15 — Reservas sin cuenta](docs/15-reservas-sin-cuenta.md).

## Ejecutar la primera versión

Requiere Node.js 24 LTS (o compatible con `>=22.12.0`). Desde esta carpeta:

```sh
npm ci
npm run dev
```

En Windows, si aparece `EBADENGINE` con Node 22.11, usar `.\scripts\npm-local.ps1 ci` y `.\scripts\npm-local.ps1 run dev`; para la API, `.\scripts\npm-local.ps1 run dev:api`. El auxiliar utiliza un Node compatible disponible en el equipo. Detener Vite con Ctrl+C antes de reinstalar para evitar archivos bloqueados (`EPERM`). Ver [solución en la guía de inicio](docs/13-puesta-en-marcha.md#windows-node-antiguo-o-archivo-bloqueado-durante-npm-ci).

Para reservas reales, en una segunda terminal con `.env.server.local` configurado:

```sh
npm run dev:api
```

Abrir `http://127.0.0.1:5173`. Sin claves se ve la interfaz, pero no se guardan operaciones. No hay clientes, turnos ni ventas ficticias en esa vista.

Para conectar la base, seguir [13 — Puesta en marcha](docs/13-puesta-en-marcha.md). Para revisar lo entregado y sus límites, leer [14 — Estado de implementación](docs/14-estado-de-implementacion.md).

```sh
npm test
npm run build
npm run test:server
npm start
```

`npm start` sirve el build de producción en el puerto `PORT` o `3000`. `npm run test:db` requiere PostgreSQL local y crea una instancia temporal propia; no se ejecuta contra Supabase remoto.

## Funcionalidad acordada

- Aplicación web responsive para clientes y personal de la peluquería.
- Interfaz con HTML, Tailwind CSS y JavaScript.
- Fondo negro, títulos dorados y subtítulos blancos.
- Base de datos propia del aplicativo en Supabase.
- Reservas según calendario, horario habilitado y turnos existentes.
- Recordatorios flotantes para peluqueros y administrador con la web abierta; 10 minutos antes para administrador y peluquero asignado.
- Registro del valor del servicio desde la lista de precios del dueño.
- Registro de cortes sin cita previa.
- Dashboard de ventas por día, semana, mes y rango de fechas.
- Preparación para subir posteriormente a un repositorio y desplegar.
- Conexión opcional del cliente a Google Calendar para sincronizar su turno.
- Descansos bloqueados por administrador o peluquero; cancelación hasta 30 minutos antes y anulación por ausencia tras 5 minutos de tolerancia.
- Administración segura de usuarios del equipo: un administrador puede invitar administradores o peluqueros sin exponer la clave privada en el navegador.

## Datos recibidos el 31 de agosto

**El Dorado Barbería**, en **Zámbiza, calle Quito**, abre de **09:00 a 21:00, de lunes a domingo**; este horario sustituye al impreso en el cartel. Trabajan **dos peluqueros y dos administradores**. Duraciones estimadas confirmadas: normal **30–45 min**, diseño **40–50 min**, con barba **40–50 min** y completo **50–60 min**. Se propone bloquear los máximos: **45/50/50/60 min**, más el margen adicional que se defina.

Precios en **USD**: corte normal **$5.00**, con diseño **$6.00**, con barba **$6.50** y completo **$8.00**. Se paga directamente en el establecimiento mediante **efectivo, transferencia o Deuna**; la web solo registra el cobro. Al reservar mostrar: **“Por favor, estar 5 minutos antes de su reserva.”** Ver [ficha del negocio](docs/11-ficha-del-negocio.md) para reglas y detalles pendientes.

## Documentos y orden de lectura

| Documento | Para qué sirve |
| --- | --- |
| [01 — Alcance y requisitos](docs/01-alcance-y-requisitos.md) | Funciones del MVP, usuarios y límites del proyecto. |
| [02 — Flujos y reglas](docs/02-flujos-y-reglas.md) | Reserva, disponibilidad, atención, cobro y métricas. |
| [03 — Arquitectura y seguridad](docs/03-arquitectura-y-seguridad.md) | Organización técnica, autenticación y permisos. |
| [04 — Modelo de datos](docs/04-modelo-de-datos.md) | Entidades, relaciones, restricciones y operaciones del servidor. |
| [05 — Interfaz y diseño](docs/05-interfaz-y-diseno.md) | Pantallas, colores, estados y experiencia móvil. |
| [06 — Recordatorios](docs/06-recordatorios.md) | Notificaciones internas, persistencia, visualización y límites. |
| [07 — Implementación y pruebas](docs/07-implementacion-y-pruebas.md) | Fases, entregables y criterios verificables. |
| [08 — Repositorio y despliegue](docs/08-repositorio-y-despliegue.md) | Preparación para Git, Railway, Supabase y alternativa Vercel. |
| [09 — Reunión con el dueño](docs/09-reunion-con-el-dueno.md) | Cuestionario y plantillas para completar. |
| [10 — Decisiones y pendientes](docs/10-decisiones-y-pendientes.md) | Fuente de verdad sobre lo confirmado y lo propuesto. |
| [11 — Ficha del negocio](docs/11-ficha-del-negocio.md) | Nombre, horario, equipo y precios aportados; diferencia entre cartel y mensaje. |
| [12 — Google Calendar](docs/12-google-calendar.md) | Sincronización opcional, autorización, cambios, cancelaciones y límites. |
| [AGENTS.md](AGENTS.md) | Guía para desarrollar el proyecto a partir de esta documentación. |

## Cómo interpretar lo pendiente

**Confirmado** significa solicitado por el usuario. **Propuesto** es una decisión de diseño revisable, no una regla aprobada por el dueño. **Pendiente** requiere datos o una decisión. Los identificadores `D01` a `D16` relacionan las preguntas con su impacto técnico.

Mientras falten datos se puede avanzar con estructura, componentes y datos ficticios claramente identificados. La reserva pública real debe permanecer deshabilitada hasta configurar servicios, duración, personal, horarios y políticas. No cargar precios ni horarios inventados en producción.

## Alojamiento previsto

Se usa **Railway para la interfaz y API, y Supabase para datos, autenticación y procesos de recordatorios**. Falta revisar periódicamente el plan y consumo disponible.

Vercel Hobby está limitado a uso personal no comercial. Por ello, no se plantea su modalidad gratuita como destino de producción para el negocio; Vercel queda como alternativa con un plan adecuado. Ver [documentación oficial de Vercel Hobby](https://vercel.com/docs/plans/hobby) y [plan de despliegue](docs/08-repositorio-y-despliegue.md).

## Siguiente paso

Seguir [13 — Puesta en marcha](docs/13-puesta-en-marcha.md) para crear el proyecto Supabase, ejecutar scripts y colocar las claves. Consultar [14 — Estado de implementación](docs/14-estado-de-implementacion.md) para las verificaciones y pendientes reales.
