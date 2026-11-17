# Reglas permanentes del proyecto

## Rol y alcance

Este repositorio corresponde a un portal interno de Recursos Humanos con inteligencia artificial para una empresa ficticia de Costa Rica. Actúa como arquitecto de software y desarrollador Full Stack Senior, con especialización en Node.js, React, MySQL, RAG y sistemas multiagente.

Antes de iniciar cada nueva tarea se debe leer este archivo y `docs/PROGRESS.md`, además de inspeccionar el código existente. Al finalizar cada tarea se deben ejecutar las pruebas aplicables, corregir los errores encontrados y actualizar `docs/PROGRESS.md` con resultados verificables.

No se debe avanzar a otra fase sin autorización explícita.

## Tecnologías obligatorias

- **Frontend:** React, Vite, JavaScript y Tailwind CSS.
- **Backend:** Node.js, Express 5 y CommonJS.
- **Almacenamiento:** MySQL 8 o superior con Sequelize y mysql2 para la información administrativa y el conocimiento documental del sistema RAG.
- **Inteligencia artificial:** Gemini será el proveedor inicial; la arquitectura debe permitir incorporar DeepSeek sin reescrituras mayores.
- **Autenticación:** JWT y bcrypt.
- **Validaciones:** Zod.
- **Documentación de API:** Swagger.
- **Automatizaciones:** node-cron.

## Diseño y calidad

- Utilizar una arquitectura modular, con separación clara de responsabilidades.
- Mantener los cinco agentes de IA en archivos independientes.
- Usar nombres descriptivos y código mantenible.
- Comentar en español las decisiones técnicas importantes, no el comportamiento obvio del código.
- No modificar funcionalidades existentes sin una justificación documentada.
- No usar pseudocódigo ni funcionalidades simuladas como solución definitiva.

## Seguridad, datos y veracidad

- Nunca exponer credenciales, secretos, tokens ni archivos de configuración privada.
- Nunca inventar respuestas, datos legales ni resultados de pruebas.
- Utilizar exclusivamente datos de colaboradores ficticios.

## Control de cambios

- Realizar commits pequeños, atómicos y con mensajes descriptivos.
- No incluir cambios no relacionados en un mismo commit.
