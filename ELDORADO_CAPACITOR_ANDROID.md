# El Dorado --- Guía de migración a APK Android con Capacitor

> **Objetivo:** convertir la aplicación actual de El Dorado Barbería en
> una aplicación Android instalable para validar su funcionamiento
> móvil, las notificaciones, los recordatorios y los flujos principales
> antes de abordar una arquitectura multiempresa.
>
> **Alcance de esta fase:** únicamente El Dorado. No implementar todavía
> multiempresa, planes de suscripción ni una APK distinta por
> peluquería.

------------------------------------------------------------------------

## 1. Estrategia elegida

Usaremos **Capacitor** para empaquetar la aplicación web existente
dentro de una aplicación Android.

La idea es reutilizar tanto como sea posible la interfaz web y el
backend actuales:

-   **Frontend:** HTML, Tailwind CSS y JavaScript existentes.
-   **Contenedor Android:** Capacitor.
-   **Backend:** API Node.js existente, desplegada en Railway.
-   **Autenticación y datos:** Supabase, según la configuración actual
    del proyecto.
-   **IDE Android:** Android Studio.
-   **Distribución de pruebas:** APK de depuración; una APK firmada o
    AAB se preparará después de superar las pruebas.

No se debe empezar una reescritura a React Native ni a Kotlin en esta
etapa.

## 2. Requisitos previos

Instalar y comprobar en el equipo de desarrollo:

-   [ ] Git.
-   [ ] Node.js LTS y npm, compatibles con las dependencias del
    repositorio.
-   [ ] Android Studio.
-   [ ] Android SDK y las herramientas de plataforma recomendadas por la
    versión instalada de Android Studio.
-   [ ] Un dispositivo Android físico con opciones de desarrollador y
    depuración USB, o un emulador.
-   [ ] Acceso al proyecto y a las variables de entorno necesarias.
-   [ ] Acceso a los entornos de prueba de Railway y Supabase.

Comprobar versiones:

``` bash
node --version
npm --version
git --version
```

No actualizar masivamente las dependencias existentes como parte de esta
migración. Primero conservar una línea base que funcione y registrar las
versiones actuales.

## 3. Crear una rama de trabajo

Desde la raíz del repositorio:

``` bash
git checkout -b feat/android-capacitor
git status
```

Antes de modificar archivos, confirmar que los cambios existentes estén
guardados o respaldados. No incluir secretos ni archivos `.env` en Git.

## 4. Auditoría inicial del proyecto

Antes de instalar Capacitor, revisar:

1.  `package.json`: scripts disponibles, herramienta de compilación y
    dependencias.
2.  La carpeta del frontend y el comando que genera sus archivos
    finales.
3.  La ubicación del archivo `index.html` generado.
4.  La configuración de rutas y navegación.
5.  Las llamadas a la API y las variables de entorno usadas por el
    frontend.
6.  La autenticación y la persistencia de sesión.
7.  Las funciones de reservas, agenda, ventas y recordatorios.
8.  Las pruebas automatizadas existentes.
9.  La configuración de Supabase, sin exponer claves privadas.

Ejecutar los comandos que ya defina el proyecto, por ejemplo:

``` bash
npm install
npm run
npm test
```

`npm test` solo debe ejecutarse si existe ese script; usar el script de
pruebas real que indique `npm run`. Registrar los resultados y resolver
los fallos preexistentes antes de atribuirlos a Capacitor.

### Confirmar el directorio de compilación

Capacitor necesita que `webDir` apunte al directorio donde se generan
los archivos web listos para producción. No asumir que es `dist`,
`build` o `public`: verificar el script de compilación y su
configuración.

Ejemplos habituales:

-   Vite: suele ser `dist`.
-   Otros proyectos: puede ser `build` u otra carpeta.

La carpeta debe contener el `index.html` final.

## 5. Instalar Capacitor

Una vez identificada la salida de compilación, instalar Capacitor desde
la raíz del proyecto:

``` bash
npm install @capacitor/core
npm install --save-dev @capacitor/cli
npx cap init
```

Durante la inicialización:

-   **Nombre de la aplicación:** `El Dorado`
-   **App ID:** elegir un identificador estable, por ejemplo
    `com.eldorado.barberia`. Verificar que esté disponible y que no
    colisione con otro identificador propio.
-   **Web directory (`webDir`):** la carpeta real de salida de
    compilación identificada en el paso anterior.

Si la CLI solicita estos valores de forma interactiva, introducirlos
allí. Si crea o actualiza `capacitor.config.ts` o
`capacitor.config.json`, revisar el resultado.

Ejemplo orientativo de configuración TypeScript:

``` ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eldorado.barberia',
  appName: 'El Dorado',
  webDir: 'dist',
};

export default config;
```

**Importante:** sustituir `dist` por el directorio real del proyecto. No
crear una segunda configuración si `npx cap init` ya creó el archivo
correspondiente.

## 6. Añadir la plataforma Android

``` bash
npm install @capacitor/android
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Notas:

-   `npm run build` debe ser el comando de compilación real del
    proyecto. Si el script tiene otro nombre, usar el correcto.
-   Si `android/` ya existe, no ejecutar `npx cap add android` a ciegas;
    revisar primero si la plataforma ya está inicializada.
-   `npx cap sync android` copia los recursos web compilados y
    sincroniza los plugins nativos.
-   Android Studio abrirá el proyecto nativo para compilarlo y
    ejecutarlo.

### Ciclo de trabajo después de modificar el frontend

``` bash
npm run build
npx cap sync android
```

Después, volver a ejecutar la app desde Android Studio o con los
comandos de Capacitor disponibles en la versión instalada.

No es necesario generar una nueva APK de distribución por cada cambio
durante el desarrollo; primero se puede ejecutar en un dispositivo
conectado.

## 7. Configurar la conexión con Railway y Supabase

### Regla principal

La aplicación instalada en el teléfono debe conectarse al backend
mediante una **URL HTTPS accesible desde el dispositivo**.

-   No usar `localhost` o `127.0.0.1` para referirse al backend
    desplegado: en el teléfono apuntan al propio teléfono.
-   Para desarrollo local con un backend en el ordenador, usar la IP
    accesible del ordenador dentro de la red de pruebas o el mecanismo
    de redirección apropiado del emulador.
-   Para validar la experiencia real, usar el dominio HTTPS del entorno
    de pruebas o producción autorizado.
-   Mantener los secretos del servidor únicamente en Railway o en el
    entorno backend.
-   Nunca incluir una clave `service_role` de Supabase, contraseñas de
    base de datos ni otros secretos en el código frontend o en la APK.

### Variables de entorno del frontend

Verificar cómo se inyecta actualmente la URL de la API. En muchas
herramientas frontend, las variables se incorporan al paquete durante la
compilación, por lo que no deben contener secretos.

Crear una configuración clara para desarrollo y producción siguiendo la
herramienta existente. No inventar nombres de variables sin revisar
primero el código.

### CORS, cookies y autenticación

Comprobar en Android:

-   Que el backend permita los orígenes y flujos necesarios para la
    aplicación.
-   Que los tokens o sesiones se guarden de manera segura y persistan
    según lo esperado.
-   Que el cierre de sesión invalide o elimine la sesión local.
-   Que los enlaces de recuperación de contraseña y OAuth regresen a la
    aplicación o al flujo web correcto.
-   Que no se dependan de cookies o dominios exclusivos del navegador de
    escritorio sin probarlos en el contenedor Android.

No desactivar controles de seguridad para hacer que una llamada
funcione. Ajustar las políticas del servidor de forma específica.

## 8. Adaptación de interfaz móvil

Antes de dar por válida la APK, comprobar:

-   [ ] Inicio de sesión y cierre de sesión.
-   [ ] Formularios utilizables con teclado virtual.
-   [ ] Calendario y selección de fecha/hora.
-   [ ] Botones y campos sin solapamientos.
-   [ ] Tablas o listados que funcionen en pantallas pequeñas.
-   [ ] Modales que se puedan abrir, desplazar y cerrar.
-   [ ] Navegación y botón Atrás de Android.
-   [ ] Estados de carga, error, conexión lenta y ausencia de datos.
-   [ ] Formato de fechas y zona horaria `America/Guayaquil` cuando
    corresponda.
-   [ ] Imágenes y recursos cargados sin rutas rotas.
-   [ ] Ausencia de desplazamiento horizontal accidental.
-   [ ] Mensajes comprensibles cuando no hay conexión.

No basta con que la página se vea en Chrome móvil: hay que probarla
dentro de la APK.

## 9. Notificaciones y recordatorios

Distinguir dos necesidades diferentes antes de implementar:

### A. Notificaciones locales

Son programadas por el dispositivo. Pueden servir para probar
recordatorios de una cita que la app ya conoce, pero hay que gestionar
cambios, cancelaciones, permisos y sincronización para evitar avisos
incorrectos.

Plugin oficial de Capacitor:

``` bash
npm install @capacitor/local-notifications
npx cap sync android
```

Validar el plugin siguiendo la documentación de la versión instalada de
Capacitor. En Android, revisar los permisos de notificación y las
restricciones de programación de alarmas exactas que apliquen a la
versión del sistema operativo. No asumir que todos los recordatorios se
entregarán a una hora exacta en todos los dispositivos.

### B. Recordatorios enviados desde el servidor (push)

Para avisar al personal aunque la app esté cerrada, la estrategia
habitual es:

1.  El backend detecta las citas que necesitan recordatorio.
2.  Un proceso programado consulta las citas próximas usando la zona
    horaria correcta.
3.  El servidor envía una notificación push al dispositivo mediante
    Firebase Cloud Messaging (FCM).
4.  La aplicación recibe y muestra la notificación.
5.  Se registra el resultado para evitar duplicados y poder investigar
    fallos.

Esta alternativa necesita configuración de Firebase, registro del token
de cada dispositivo, permisos, un proceso programado del lado servidor,
gestión de reintentos y control de duplicados. Las credenciales privadas
de FCM deben permanecer en el servidor.

**Recomendación para esta fase:**

-   Primero comprobar si ya existe una lógica de recordatorios en el
    backend y documentar exactamente cuándo se ejecuta.
-   Probar notificaciones locales para validar permisos y presentación
    si resulta útil.
-   Para recordatorios de citas fiables cuando la app está cerrada,
    implementar push desde el servidor antes de considerar la
    funcionalidad terminada.
-   No depender exclusivamente de un temporizador JavaScript en la app:
    puede dejar de ejecutarse cuando Android suspende o cierra el
    proceso.
-   Definir si los avisos se dirigen al barbero, al administrador, al
    cliente o a varios destinatarios. Esta guía prioriza validar la
    aplicación del personal de El Dorado.

### Casos de prueba de notificaciones

-   [ ] Primer permiso aceptado.
-   [ ] Primer permiso rechazado y comportamiento posterior.
-   [ ] App abierta y en segundo plano.
-   [ ] App cerrada.
-   [ ] Dispositivo reiniciado, cuando aplique.
-   [ ] Cita modificada: no se envía el recordatorio antiguo.
-   [ ] Cita cancelada: no se envía el recordatorio cancelado.
-   [ ] Recordatorio enviado una sola vez.
-   [ ] Zona horaria correcta.
-   [ ] Dispositivo sin conexión temporal y posterior recuperación, si
    aplica al mecanismo utilizado.
-   [ ] La notificación abre la pantalla adecuada, sin exponer
    información privada en la pantalla bloqueada.

## 10. Plan de validación funcional

Usar datos de prueba y no alterar citas o ventas reales sin
autorización. Registrar el dispositivo, versión de Android, versión de
la app, pasos reproducibles, resultado esperado y resultado observado.

  -----------------------------------------------------------------------
  ID                      Prueba                  Resultado esperado
  ----------------------- ----------------------- -----------------------
  APK-01                  Instalar la APK de      Instala sin error y
                          depuración              muestra el nombre/icono
                                                  previstos

  AUTH-01                 Iniciar sesión con      Acceso correcto
                          credenciales válidas    

  AUTH-02                 Iniciar sesión con      Error claro, sin
                          contraseña incorrecta   revelar información
                                                  sensible

  AUTH-03                 Cerrar sesión y reabrir La sesión se comporta
                          la app                  según la política
                                                  definida

  API-01                  Consultar datos con     La información se carga
                          conexión                desde el backend

  API-02                  Probar sin conexión o   Se muestra un error
                          con API inaccesible     controlado, sin bloqueo
                                                  permanente

  AGENDA-01               Consultar agenda diaria Citas y horas correctas

  CITA-01                 Crear una cita de       Se guarda y aparece en
                          prueba                  la agenda

  CITA-02                 Modificar una cita      Se conservan los
                                                  cambios correctos

  CITA-03                 Cancelar una cita de    Se actualiza el estado
                          prueba                  y se aplica la política
                                                  definida

  VENTA-01                Registrar una venta de  Totales y datos
                          prueba                  correctos

  NAV-01                  Usar Atrás y cambiar de No se cierra
                          pantallas               inesperadamente ni se
                                                  pierde información sin
                                                  aviso

  NOTIF-01                Conceder permiso de     El sistema refleja
                          notificación            correctamente el
                                                  permiso

  NOTIF-02                Recibir recordatorio de Llega según el
                          prueba                  mecanismo implementado
                                                  y el horario definido

  NOTIF-03                Modificar o cancelar la No llega un aviso
                          cita                    obsoleto

  REG-01                  Revisar logs del        No se filtran
                          servidor                contraseñas, tokens ni
                                                  secretos

  PERF-01                 Navegar por las         Sin bloqueos, errores
                          pantallas principales   visuales críticos ni
                                                  lentitud anormal
  -----------------------------------------------------------------------

Añadir o quitar pruebas según las funciones reales del repositorio. No
marcar una prueba como aprobada hasta haberla ejecutado.

### Registro de defectos

Para cada error guardar:

-   ID de prueba.
-   Modelo de teléfono y versión de Android.
-   Versión/commit de la aplicación.
-   Pasos para reproducirlo.
-   Resultado esperado y resultado obtenido.
-   Captura o log sin información sensible.
-   Severidad: bloqueante, alta, media o baja.
-   Estado: pendiente, en corrección, listo para validar o cerrado.

## 11. Generar la APK de prueba

Después de que compile y funcione en Android Studio:

1.  Ejecutar la app en un dispositivo físico.
2.  Revisar los logs y corregir errores.
3.  Confirmar que los flujos principales y las pruebas de notificaciones
    están documentados.
4.  En Android Studio, usar **Build \> Build Bundle(s) / APK(s) \> Build
    APK(s)** para generar una APK de depuración.
5.  Usar la opción de localización del resultado que muestra Android
    Studio. En proyectos estándar suele quedar bajo
    `android/app/build/outputs/apk/debug/`, pero verificar la ruta real.
6.  Instalarla en otro dispositivo de prueba y repetir las pruebas
    críticas.

Alternativa por terminal, desde la raíz del repositorio:

``` bash
cd android
```

En Windows:

``` powershell
.\gradlew.bat assembleDebug
```

En macOS/Linux:

``` bash
./gradlew assembleDebug
```

La ruta estándar del resultado es
`android/app/build/outputs/apk/debug/app-debug.apk`, si la configuración
del proyecto no la modifica.

La APK de depuración sirve para pruebas, no para distribución pública
definitiva.

### APK firmada y Google Play

Una vez validada la aplicación:

-   Generar una APK firmada para distribución directa, o un AAB firmado
    para Google Play.
-   Guardar el archivo de firma y sus contraseñas de forma segura fuera
    del repositorio.
-   No subir keystores, contraseñas ni archivos de secretos a Git.
-   Definir una política de incremento de `versionCode` y `versionName`.
-   Verificar los requisitos vigentes de Google Play antes de publicar.

## 12. Criterios para considerar terminada esta fase

La fase Android se considera lista para evaluación cuando:

-   [ ] Se puede instalar y abrir la APK en al menos dos dispositivos o
    en un dispositivo y un emulador.
-   [ ] El inicio y cierre de sesión funcionan.
-   [ ] Los flujos de agenda, citas y ventas prioritarios funcionan sin
    errores bloqueantes.
-   [ ] La app se conecta al backend HTTPS correcto.
-   [ ] No hay secretos incluidos en el paquete.
-   [ ] Los errores de conexión se manejan de forma controlada.
-   [ ] Las notificaciones tienen una estrategia documentada y las
    pruebas aplicables están aprobadas.
-   [ ] Los recordatorios no se duplican ni se envían para citas
    canceladas en los escenarios probados.
-   [ ] No hay defectos bloqueantes o de severidad alta sin resolver.
-   [ ] Existe un registro de pruebas y un commit identificable de la
    versión validada.

## 13. Fuera del alcance por ahora

No desarrollar todavía:

-   Arquitectura multiempresa.
-   Tabla `businesses` ni migración multiempresa, salvo que una
    auditoría revele una necesidad indispensable para la fase móvil.
-   Alta autónoma de peluquerías.
-   Suscripciones y facturación SaaS.
-   APK personalizada para cada peluquería.
-   Migración a React Native o Kotlin.
-   Nuevas funcionalidades que no sean necesarias para validar la
    versión actual.

## 14. Documentación oficial

Consultar la documentación correspondiente a la versión instalada:

-   Capacitor: https://capacitorjs.com/docs
-   Instalación de Android: https://capacitorjs.com/docs/android
-   Configuración: https://capacitorjs.com/docs/config
-   Plugin Local Notifications:
    https://capacitorjs.com/docs/apis/local-notifications
-   Firebase Cloud Messaging:
    https://firebase.google.com/docs/cloud-messaging
-   Android Studio: https://developer.android.com/studio
-   Supabase Row Level Security:
    https://supabase.com/docs/guides/database/postgres/row-level-security

## 15. Orden de ejecución recomendado

1.  Auditar y ejecutar el proyecto web actual.
2.  Crear la rama `feat/android-capacitor`.
3.  Configurar `webDir` e instalar Capacitor.
4.  Generar y abrir la plataforma Android.
5.  Corregir diseño y navegación móvil.
6.  Verificar API, sesión y datos.
7.  Implementar y probar notificaciones/recordatorios.
8.  Ejecutar la matriz de pruebas.
9.  Generar APK de depuración.
10. Validar en dispositivos físicos, corregir y repetir.
11. Solo después de la validación, generar el artefacto firmado de
    distribución.

**Regla de trabajo:** avanzar paso a paso, ejecutar los comandos en el
repositorio real y revisar los resultados antes de continuar. No
declarar la APK lista hasta instalarla y probarla en un dispositivo
Android.
