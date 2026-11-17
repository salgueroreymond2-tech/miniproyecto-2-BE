# Progreso del proyecto

**Última actualización:** 17 de noviembre de 2026<br>
**Fase actual:** Autenticación y control de acceso.<br>
**Estado:** Implementación local y pruebas aisladas completadas; pendiente integración con Supabase real.

## Tareas completadas

- Se inspeccionó la estructura inicial del repositorio: no había código fuente, configuraciones de aplicación ni suite de pruebas.
- Se creó `AGENTS.md` con las reglas permanentes de arquitectura, tecnologías, seguridad, calidad y control de cambios.
- Se creó este registro de progreso.
- Se verificó que el repositorio Git usa la rama local `main` y tiene configurado el remoto `origin` hacia `https://github.com/salgueroreymond2-tech/miniproyecto-2-BE.git`.
- Se creó el commit local `a813cd6` (`docs: add project governance and initial progress`) con los archivos de gobierno iniciales.
- Se corrigió la decisión de base de datos por instrucción explícita: PostgreSQL en Supabase con pgvector sustituye MySQL.
- Se definió la identidad ficticia única: NexoTico Servicios Tecnológicos, S.R.L., empresa B2B de servicios tecnológicos en Costa Rica con 50 colaboradores ficticios.
- Se investigaron fuentes oficiales del MTSS, SCIJ/PGR, CCSS y PRODHAB para fundamentar el corpus documental.
- Se crearon diez políticas en Markdown para RAG, cada una con objetivo, alcance, obligaciones legales verificadas, política interna ficticia, procedimiento, excepciones, preguntas de recuperación y fuentes.
- Se generaron 10 archivos DOCX y 10 PDF de distribución, una matriz XLSX de conocimiento con 11 hojas y un informe de investigación de ocho páginas en Markdown, DOCX y PDF.
- Se crearon `database/extensions.sql`, `schema.sql`, `indexes.sql`, `permissions.sql` y `seed.sql`, con las tablas obligatorias, integridad referencial, restricciones, índices, RLS y permisos de mínimo privilegio.
- Se generaron 50 colaboradores ficticios deterministas, tres meses de movimientos, vacaciones, solicitudes, incapacidades, evaluaciones, fechas de pago, documentos RAG y reportes diarios para indicadores.
- Se agregó un pool PostgreSQL de carga diferida, verificación de conexión y repositorio con consultas parametrizadas, sin implementar agentes ni lógica de negocio.
- Se añadió el diagrama entidad-relación en `docs/database-erd.md` y la guía de ejecución en `database/README.md`.
- Se implementaron los siete endpoints de autenticación y consultas propias, más `/api/health` y documentación Swagger.
- Se creó una pantalla React de inicio de sesión con redirección por rol y vistas protegidas mientras exista sesión en memoria.
- Se añadió `database/auth-permissions.sql` para retirar acceso directo a hashes y conceder privilegios de lectura específicos al rol del backend; requiere aplicación y comprobación en Supabase.

## Decisiones técnicas

- No se creó código, configuración de aplicación ni estructura funcional, porque esta tarea está limitada al diagnóstico y a los archivos de gobierno del proyecto.
- Las decisiones de implementación se tomarán en una fase posterior y requerirán autorización previa.
- PostgreSQL en Supabase es la única base de datos permitida para el proyecto; `pgvector` se usa para el corpus RAG.
- La tabla `fragmentos_documentos` acepta únicamente embeddings de `gemini-embedding-001` con 768 dimensiones. Cambiar modelo o dimensión exige una migración y re-embebido completo.
- El JWT pertenece a la API Express; cada petición autenticada consulta el estado y rol actual del usuario. El frontend no consulta tablas directamente.
- El límite de login se guarda en memoria por instancia; para despliegue con varias instancias se requiere un almacén compartido y configuración de proxy revisada.
- Markdown es la fuente de verdad para recuperación RAG; los PDF y DOCX son copias de distribución y la matriz XLSX permite importación estructurada en Google Sheets.
- Las obligaciones legales verificadas se mantienen separadas de las reglas internas ficticias de NexoTico para evitar que el sistema RAG confunda una política corporativa con un derecho legal.
- El corpus prohíbe incorporar expedientes personales, diagnósticos, denuncias, identificaciones, cuentas bancarias o evaluaciones individuales en RAG sin aprobación del Comité de Gobierno de Información y revisión específica.

## Pruebas y verificaciones realizadas

- Inspección de archivos: solamente existía el directorio `.git`; no hay una aplicación o pruebas automáticas que ejecutar.
- Herramientas disponibles: Node.js `v22.18.0`, npm `10.9.3` y Git `2.50.1.windows.1`.
- Se verificó el remoto Git `origin` y el estado inicial de la rama `main`, sin commits.
- Docker CLI `29.9.3` está instalado.
- Se comprobó que no existe `DATABASE_URL` en el entorno, por lo que no se inició conexión externa.
- Se verificó que las 10 políticas Markdown contienen todas las secciones obligatorias.
- Se verificó la estructura ZIP/OpenXML de los 10 DOCX y las 11 hojas de la matriz XLSX.
- Se verificó la cabecera de los 10 PDF de políticas y del informe; el informe contiene 8 páginas, dentro del rango solicitado de 6 a 10.
- Se comprobó que el corpus documental no contiene referencias a PostgreSQL, Supabase ni pgvector.
- La validación estática confirma las 14 tablas requeridas, el vector de 768 dimensiones, la restricción de modelo de embeddings, el índice vectorial, RLS, 50 colaboradores ficticios y ausencia de diagnósticos médicos.
- `npm test` pasó 2 de 2 pruebas: el pool no se crea sin credenciales y las consultas sin configuración fallan de forma controlada.
- Dependencias verificadas: `pg 8.23.1`, `dotenv 16.6.1` y `zod 4.6.7`; `npm audit --omit=dev` reportó 0 vulnerabilidades después de actualizar Zod.
- Autenticación: 8 pruebas backend pasaron con repositorios aislados, cubriendo bcrypt, JWT vencido o inválido, roles, identidad propia, entradas inválidas, inyección y consultas parametrizadas.
- Frontend: 3 pruebas de redirección y protección de rutas pasaron; `npm run build` compiló correctamente.
- Backend y frontend se iniciaron localmente; `/api/health` respondió directamente y mediante el proxy Vite, y Swagger respondió HTTP 200.

## Errores e incidencias

- El daemon de Docker no está en ejecución, por lo que no está disponible para contenedores locales actualmente.
- El entorno aislado no puede leer `C:\Users\HP8D8\.docker\config.json`; no se modificó ese archivo.
- No hay `DATABASE_URL`, instancia Supabase ni cliente `psql` disponible en el entorno para ejecutar los scripts y verificar integridad en una base real.
- Las pruebas de login y permisos no se han ejecutado contra PostgreSQL/Supabase real; tampoco se ha validado la migración de RLS en esa instancia.
- La publicación hacia GitHub no se realizó: el entorno requiere autorización explícita antes de exportar los archivos del proyecto al remoto.
- El sitio oficial de PRODHAB respondió 403 desde el entorno de investigación. Se dejó constancia de la limitación y se verificó el objetivo de la Ley N.° 8968 mediante SCIJ/PGR; no se inventó contenido de PRODHAB.
- No se recibió ni se encontró en el repositorio el enunciado académico o banco de preguntas contra el cual realizar una cobertura literal; se documentó este pendiente en el informe.
- No se recibió el catálogo académico de campos de las tablas; se usaron campos operativos derivados de las políticas y se documentó el supuesto en `database/README.md` y el ERD.

## Pendientes

- Esperar autorización antes de iniciar una nueva fase o modificar el corpus documental.
- Contrastar las políticas contra el enunciado académico cuando sea suministrado.
- Revisar la versión vigente de las normas y los trámites de PRODHAB con asesoría legal antes de una publicación o uso real.
- Configurar `DATABASE_URL` de servidor y ejecutar los scripts en un proyecto Supabase de desarrollo para verificar integridad real.
- Aplicar y probar `database/auth-permissions.sql`, configurar el usuario dedicado del backend, asignar contraseñas bcrypt y ejecutar pruebas de integración con usuarios y roles reales ficticios.
- Contrastar el esquema con el catálogo de campos académico cuando sea suministrado y crear migraciones no destructivas si hay diferencias.
- Definir la estructura inicial de frontend, backend y la estrategia de conexión segura con Supabase PostgreSQL cuando sea autorizada.
- Publicar los commits locales en `origin/main` únicamente si se autoriza expresamente.
