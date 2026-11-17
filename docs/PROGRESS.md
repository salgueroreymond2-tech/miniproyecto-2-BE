# Progreso del proyecto

**Última actualización:** 17 de noviembre de 2026<br>
**Fase actual:** Base documental de Recursos Humanos para RAG.<br>
**Estado:** Completada; se detiene el trabajo a la espera de autorización.

## Tareas completadas

- Se inspeccionó la estructura inicial del repositorio: no había código fuente, configuraciones de aplicación ni suite de pruebas.
- Se creó `AGENTS.md` con las reglas permanentes de arquitectura, tecnologías, seguridad, calidad y control de cambios.
- Se creó este registro de progreso.
- Se verificó que el repositorio Git usa la rama local `main` y tiene configurado el remoto `origin` hacia `https://github.com/salgueroreymond2-tech/miniproyecto-2-BE.git`.
- Se creó el commit local `a813cd6` (`docs: add project governance and initial progress`) con los archivos de gobierno iniciales.
- Se estableció MySQL como tecnología de base de datos obligatoria.
- Se definió la identidad ficticia única: NexoTico Servicios Tecnológicos, S.R.L., empresa B2B de servicios tecnológicos en Costa Rica con 50 colaboradores ficticios.
- Se investigaron fuentes oficiales del MTSS, SCIJ/PGR, CCSS y PRODHAB para fundamentar el corpus documental.
- Se crearon diez políticas en Markdown para RAG, cada una con objetivo, alcance, obligaciones legales verificadas, política interna ficticia, procedimiento, excepciones, preguntas de recuperación y fuentes.
- Se generaron 10 archivos DOCX y 10 PDF de distribución, una matriz XLSX de conocimiento con 11 hojas y un informe de investigación de ocho páginas en Markdown, DOCX y PDF.

## Decisiones técnicas

- No se creó código, configuración de aplicación ni estructura funcional, porque esta tarea está limitada al diagnóstico y a los archivos de gobierno del proyecto.
- Las decisiones de implementación se tomarán en una fase posterior y requerirán autorización previa.
- MySQL es la única base de datos permitida para el proyecto.
- Markdown es la fuente de verdad para recuperación RAG; los PDF y DOCX son copias de distribución y la matriz XLSX permite importación estructurada en Google Sheets.
- Las obligaciones legales verificadas se mantienen separadas de las reglas internas ficticias de NexoTico para evitar que el sistema RAG confunda una política corporativa con un derecho legal.
- El corpus prohíbe incorporar expedientes personales, diagnósticos, denuncias, identificaciones, cuentas bancarias o evaluaciones individuales en RAG sin aprobación del Comité de Gobierno de Información y revisión específica.

## Pruebas y verificaciones realizadas

- Inspección de archivos: solamente existía el directorio `.git`; no hay una aplicación o pruebas automáticas que ejecutar.
- Herramientas disponibles: Node.js `v22.18.0`, npm `10.9.3` y Git `2.50.1.windows.1`.
- Se verificó el remoto Git `origin` y el estado inicial de la rama `main`, sin commits.
- Docker CLI `29.9.3` está instalado.
- Se comprobó que el cliente de línea de comandos `mysql` no está disponible en el entorno actual.
- Se validó que las reglas y el progreso únicamente establecen MySQL como base de datos del proyecto.
- Se verificó que las 10 políticas Markdown contienen todas las secciones obligatorias.
- Se verificó la estructura ZIP/OpenXML de los 10 DOCX y las 11 hojas de la matriz XLSX.
- Se verificó la cabecera de los 10 PDF de políticas y del informe; el informe contiene 8 páginas, dentro del rango solicitado de 6 a 10.
- Se comprobó que el corpus documental no contiene referencias a PostgreSQL, Supabase ni pgvector.

## Errores e incidencias

- El daemon de Docker no está en ejecución, por lo que no está disponible para contenedores locales actualmente.
- El entorno aislado no puede leer `C:\Users\HP8D8\.docker\config.json`; no se modificó ese archivo.
- No se detectó el cliente `mysql` en el entorno actual.
- La publicación hacia GitHub no se realizó: el entorno requiere autorización explícita antes de exportar los archivos del proyecto al remoto.
- El sitio oficial de PRODHAB respondió 403 desde el entorno de investigación. Se dejó constancia de la limitación y se verificó el objetivo de la Ley N.° 8968 mediante SCIJ/PGR; no se inventó contenido de PRODHAB.
- No se recibió ni se encontró en el repositorio el enunciado académico o banco de preguntas contra el cual realizar una cobertura literal; se documentó este pendiente en el informe.

## Pendientes

- Esperar autorización antes de iniciar una nueva fase o modificar el corpus documental.
- Contrastar las políticas contra el enunciado académico cuando sea suministrado.
- Revisar la versión vigente de las normas y los trámites de PRODHAB con asesoría legal antes de una publicación o uso real.
- Definir la estructura inicial de frontend, backend y la estrategia de conexión segura con MySQL cuando sea autorizada.
- Publicar los commits locales en `origin/main` únicamente si se autoriza expresamente.
