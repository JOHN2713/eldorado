# 09 — Reunión con el dueño

**Actualización de datos:** 31 de agosto de 2026; no se afirma que la reunión ya se haya realizado.<br>
**Participantes:** POR DEFINIR.<br>
**Objetivo:** completar los datos mínimos y acordar cómo operará la primera versión.

Ya se recibieron nombre/dirección/USD, precios y rangos por servicio, horario/equipo, pagos directos, cancelación/tolerancia, consejo de llegada, descansos, avisos al personal, URL y solicitud Google Calendar. Ver [ficha del negocio](11-ficha-del-negocio.md). Priorizar margen/cuadrícula, jornadas/nombres, acceso de clientes y configuración Google (avisos a 10 minutos ya confirmados); no volver a pedir acuerdos ya recibidos.

## Preguntas y su impacto

| ID | Preguntas para el dueño | Por qué se necesita |
| --- | --- | --- |
| D01 | Nombre y dirección Zámbiza, calle Quito recibidos. ¿Número/referencia, contacto y nombre del administrador? | Completar ubicación y responsable operativo. |
| D02 | USD confirmado. Validar zona técnica propuesta `America/Guayaquil`. ¿El día de reportes termina a medianoche? | Agrupación de ventas y horas en Google Calendar. |
| D03 | Dos peluqueros con acceso para avisos/descansos y un administrador. ¿Nombres, servicios por peluquero, permiso de cobro, elección por cliente y recursos compartidos? | Completar agendas y permisos. |
| D04 | Rangos recibidos; validar bloques máximos propuestos 45/50/50/60. ¿Margen adicional? ¿Qué incluye completo y qué significa “con turnos”? ¿Se respeta el precio reservado? | Agenda suficiente y reglas del catálogo. |
| D05 | Confirmada apertura de 09:00 a 21:00 todos los días. ¿Descansos, feriados y jornadas de cada peluquero? ¿Cada cuánto ofrecer horas? | Completar disponibilidad sin asumir que ambos trabajan toda la jornada. |
| D06 | ¿Con cuánta anticipación mínima y máxima reservar? ¿Se permite el mismo día? ¿Confirmación automática o manual? ¿Límite de citas activas por cliente? | Políticas para reservar y evitar abuso. |
| D07 | Cancelación hasta 30 min antes y tolerancia 5 min confirmadas. ¿Plazo para reprogramar? ¿Excepciones administrativas? | Completar cambios sin alterar reglas aprobadas. |
| D08 | Pago directo efectivo/transferencia/Deuna confirmado. ¿Dashboard de cobrado o realizado? ¿Quién registra cobro, impuestos incluidos, descuentos, propinas, correcciones y retroactividad? | Registro operativo; sin integrar pagos. |
| D09 | Confirmado: sin cuenta, nombre/celular/correo obligatorios. ¿Cómo atender recuperación del enlace perdido y cuál será el plazo de conservación? | Autenticación, recuperación de citas y privacidad. |
| D10 | ¿Quién ve ventas y reportes? ¿Semana de lunes a domingo? ¿Necesita filtrar por profesional/servicio o exportar? | Permisos y alcance del dashboard. |
| D11 | Confirmados a 10 minutos para peluquero asignado y administrador. ¿Necesitan además avisos de cambios? | Programación; propuesta de agenda asignada + admin y límite con web cerrada. |
| D12 | ¿Qué aviso se mostrará y qué preferencias se recogerán? ¿Cuánto conservar datos? ¿Quién atiende solicitudes y fallos? | Manejo responsable de contactos y operación. |
| D13 | Cartel recibido. ¿Archivo original del logotipo, fotos autorizadas, tipografía y textos finales? ¿El dorado propuesto representa la marca? | Completar la identidad visual. |
| D14 | Repositorio indicado: JOHN2713/eldorado. ¿Acceso y rama? ¿Plan/cuenta Railway, dominio, cuenta Supabase, región y presupuesto? ¿Quién conserva accesos y respaldos? | Preparar publicación preservando el contenido existente. |
| D15 | ¿Fecha deseada del piloto y prioridad de funciones? ¿Qué puede esperar? ¿Quién valida y capacita al personal? | Entrega por fases y aceptación. |
| D16 | Google Calendar solicitado. ¿Quién administra Google Cloud, dominio y consentimiento OAuth? Elegir calendario destino y alcance mínimo durante integración. | Sincronización opcional con cuentas propias; no bloquear reserva si Google falla. |

## Ficha del negocio

| Dato | Respuesta |
| --- | --- |
| Nombre comercial | El Dorado Barbería |
| Dueño / responsable | POR DEFINIR |
| Dirección | Zámbiza, calle Quito; número/referencia pendiente |
| Teléfono público | POR DEFINIR |
| Correo público | POR DEFINIR |
| Moneda | Dólar estadounidense, USD |
| Zona horaria IANA | Propuesta `America/Guayaquil`, por validar al configurar |
| Nombre / URL de dominio | POR DEFINIR |
| Repositorio indicado | [JOHN2713/eldorado](https://github.com/JOHN2713/eldorado); acceso y contenido no verificados |

## Catálogo entregado por el dueño

Precios del cartel y rangos específicos confirmados por el usuario. USD confirmado. Propuesta técnica: reservar el máximo de cada rango, separándolo del tiempo real; completar margen y cuadrícula antes de producción.

| Código | Servicio | Precio | Moneda | Rango / bloque propuesto | Margen posterior | Profesionales habilitados | Notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Por asignar | Corte normal | $5.00 | USD | 30–45 / 45 min | POR DEFINIR | POR DEFINIR | Precio del cartel |
| Por asignar | Corte con diseño | $6.00 | USD | 40–50 / 50 min | POR DEFINIR | POR DEFINIR | Precio del cartel |
| Por asignar | Corte con barba | $6.50 | USD | 40–50 / 50 min | POR DEFINIR | POR DEFINIR | “Barba” se vincula a este servicio |
| Por asignar | Corte completo | $8.00 | USD | 50–60 / 60 min | POR DEFINIR | POR DEFINIR | Aclarar alcance y frase “con turnos” |

Confirmar si el precio publicado incluye todo lo que debe cobrar el local y si existen variaciones por profesional o cliente. Esas variaciones requieren una regla explícita, no edición libre de importes desde el navegador.

## Horario habitual del local

Horario confirmado por mensaje; reemplaza al horario distinto del cartel. Completar descansos y jornadas personales por separado: no se han confirmado doce horas continuas de trabajo para cada peluquero.

| Día | Primera franja | Segunda franja | Observaciones |
| --- | --- | --- | --- |
| Lunes | 09:00–21:00 | No indicada | Descansos por definir |
| Martes | 09:00–21:00 | No indicada | Descansos por definir |
| Miércoles | 09:00–21:00 | No indicada | Descansos por definir |
| Jueves | 09:00–21:00 | No indicada | Descansos por definir |
| Viernes | 09:00–21:00 | No indicada | Descansos por definir |
| Sábado | 09:00–21:00 | No indicada | Descansos por definir |
| Domingo | 09:00–21:00 | No indicada | Descansos por definir |

Excepciones conocidas: POR DEFINIR. Responsable de mantener feriados y ausencias: POR DEFINIR.

## Equipo y horarios individuales

| Integrante | Servicios que realiza | Jornada individual | Puede iniciar sesión | Rol necesario |
| --- | --- | --- | --- | --- |
| Peluquero 1 — nombre pendiente | POR DEFINIR | POR DEFINIR | Sí, cuenta por crear | Peluquero; sus avisos y descansos |
| Peluquero 2 — nombre pendiente | POR DEFINIR | POR DEFINIR | Sí, cuenta por crear | Peluquero; sus avisos y descansos |
| Administrador — nombre pendiente | No se ha confirmado que realice cortes | POR DEFINIR | Sí, cuenta por crear | Administrador |

Si existen menos sillas que profesionales simultáneos, anotarlo aquí: POR DEFINIR. Ese caso modifica la propuesta de disponibilidad por profesional.

## Acuerdos operativos

| Regla | Acuerdo |
| --- | --- |
| Paso entre horas ofrecidas | POR DEFINIR |
| Anticipación mínima y horizonte máximo | POR DEFINIR |
| Reserva del mismo día | POR DEFINIR |
| Confirmación automática o manual | POR DEFINIR |
| Cancelación | Hasta 30 minutos antes, incluido el límite |
| Reprogramación y excepciones | POR DEFINIR |
| Llegada y ausencia | Esperar 5 minutos tras la reserva; anular por inasistencia si no llegó. Registrar llegada separada del inicio |
| Recomendación al cliente | “Por favor, estar 5 minutos antes de su reserva.” |
| Descansos | Administrador y peluquero pueden bloquear; propuesta: peluquero en su agenda, admin en cualquiera, sin invadir citas |
| Precio aplicable al cambiar la tarifa | POR DEFINIR |
| Registro retrospectivo y corrección de ventas | POR DEFINIR |
| Medios de pago | Directo en el local: efectivo, transferencia o Deuna. Solo registro manual, sin pasarela |
| Concepto de “vendido” | Propuesta: cobrado; por confirmar |
| Canal de recordatorios | Flotante dentro de la web abierta; sin aviso externo al cerrarla |
| Destinatarios de recordatorios | Peluqueros y administrador; propuesta de asignado + admin |
| Anticipación de recordatorios | POR DEFINIR |
| Acceso del cliente y datos mínimos | POR DEFINIR |
| Visibilidad de reportes e inicio de semana | POR DEFINIR |
| Google Calendar | Conexión voluntaria solicitada; propuesta de sincronización app → Google con OAuth y seguimiento de cambios/cancelación |

## Material y accesos que se necesitarán después

- Validar bloques máximos propuestos, definir margen y alcance del corte completo.
- Jornadas individuales, descansos, feriados y ausencias previstas.
- Nombres de los dos peluqueros y del administrador; permisos de acceso.
- Logotipo original y fotografías autorizadas, si se usarán.
- Datos del dominio y acceso al repositorio indicado y cuentas de plataforma, mediante invitaciones cuando corresponda.
- Anticipación de recordatorios al personal; no se necesita proveedor de mensajes para los flotantes.
- Responsable y configuración de Google Cloud/OAuth para la integración opcional del cliente.

**No pegar contraseñas, tokens, claves privadas ni datos reales de clientes en esta ficha o en Git.** Los accesos se configuran mediante permisos de plataforma y gestores de secretos.

## Cierre de la reunión

| Acuerdo / pendiente | ID relacionado | Responsable | Fecha objetivo | Estado |
| --- | --- | --- | --- | --- |
| POR DEFINIR | POR DEFINIR | POR DEFINIR | POR DEFINIR | Pendiente |

Al terminar, actualizar [las decisiones](10-decisiones-y-pendientes.md), después los flujos y el modelo afectados. Si una respuesta contradice una propuesta, prevalece lo acordado con el dueño; documentar el cambio para evitar versiones distintas de la misma regla.
