# Guía de trabajo del proyecto

## Contexto

Este repositorio comienza como documentación para un aplicativo de peluquería. Antes de implementar, leer `README.md`, `docs/10-decisiones-y-pendientes.md` y los documentos del módulo correspondiente. Respetar las instrucciones vigentes del usuario.

## Reglas para desarrollar

- Usar HTML semántico, Tailwind CSS y JavaScript modular. Vite es la herramienta de construcción propuesta; no introducir otro framework sin una necesidad justificada.
- Usar Supabase para la base de datos. Separar presentación, reglas del servidor y acceso a datos.
- Conservar la identidad visual: negro, títulos dorados y subtítulos blancos.
- No convertir propuestas en decisiones confirmadas. Registrar los cambios en `docs/10-decisiones-y-pendientes.md` y actualizar los documentos afectados.
- Avanzar con trabajo independiente de los pendientes. Datos de muestra solo en desarrollo, etiquetados como ficticios.
- Configurar horarios, precios, duración, profesionales y políticas mediante datos; no fijarlos dentro de componentes.
- Validar reservas y cobros en el servidor; la validación del navegador solo mejora la experiencia.
- Proteger datos con autenticación, permisos y RLS. No permitir que un usuario se asigne permisos administrativos.
- No exponer claves secretas de Supabase, contraseñas o tokens de mensajería en el cliente, los documentos o Git.
- Mantener historial de precios vendidos y auditoría; no borrar ventas para corregirlas.
- Las migraciones, las pruebas críticas y los cambios de contrato deben acompañar a la funcionalidad correspondiente.
- Revisar móvil, accesibilidad básica, estados vacíos y errores. No dar por terminado un flujo que solo funciona con datos ideales.
- Seguir `docs/07-implementacion-y-pruebas.md` para los criterios de aceptación y `docs/08-repositorio-y-despliegue.md` para la publicación futura.

## Entrega de cada fase

Indicar qué se implementó, cómo se verificó y qué sigue pendiente. No afirmar que existen servicios, integraciones, pruebas aprobadas o despliegues que no se han realizado.
