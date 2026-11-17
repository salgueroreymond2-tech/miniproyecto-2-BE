# Progreso del proyecto

**Última actualización:** 17 de noviembre de 2026<br>
**Fase actual:** Separación MySQL administrativa y Supabase vectorial.<br>
**Estado:** Migración y datos ficticios aplicados en MySQL local; Supabase vectorial pendiente de configuración y validación.

## Tareas completadas

- Se inspeccionó la estructura inicial del repositorio: no había código fuente, configuraciones de aplicación ni suite de pruebas.
- Se creó `AGENTS.md` con las reglas permanentes de arquitectura, tecnologías, seguridad, calidad y control de cambios.
- Se creó este registro de progreso.
- Se verificó que el repositorio Git usa la rama local `main` y tiene configurado el remoto `origin` hacia `https://github.com/salgueroreymond2-tech/miniproyecto-2-BE.git`.
- Se creó el commit local `a813cd6` (`docs: add project governance and initial progress`) con los archivos de gobierno iniciales.
- En una fase anterior se utilizó PostgreSQL administrativo; esta decisión fue sustituida por la arquitectura vigente MySQL más Supabase vectorial.
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

- La fase inicial se limitó al diagnóstico y a los archivos de gobierno; las fases posteriores fueron autorizadas mediante instrucciones específicas.
- Decisión vigente: MySQL 8 con Sequelize/mysql2 almacena los datos administrativos; Supabase con pgvector se usa exclusivamente para conocimiento documental. Los scripts administrativos PostgreSQL anteriores son históricos y no deben ejecutarse.
- La tabla `fragmentos_documentos` acepta únicamente embeddings de `gemini-embedding-001` con 768 dimensiones. Cambiar modelo o dimensión exige una migración y re-embebido completo.
- El JWT pertenece a la API Express; cada petición autenticada consulta el estado y rol actual del usuario. El frontend no consulta tablas directamente.
- El límite de login se guarda en memoria por instancia; para despliegue con varias instancias se requiere un almacén compartido y configuración de proxy revisada.
- Se creó `backend/.env` con campos vacíos, a petición del usuario; permanece excluido de Git. No se han recibido credenciales.
- Se definieron 15 modelos Sequelize, migración MySQL, seeder de demostración, repositorios parametrizados y una conexión separada de solo lectura.
- Se prepararon los cinco scripts de Supabase, RPC de búsqueda coseno y publicación atómica de versiones completas, y servicios de vectores y embeddings.
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
- En esta fase `npm test` del backend pasó 12 pruebas aisladas, incluidas las asociaciones de 15 modelos, preparación de 50 usuarios/colaboradores ficticios, validación vectorial y conservación de controles de autenticación. No se han insertado estos datos en una base real.
- `npm run db:mysql:verify` y `npm run db:supabase:verify` terminaron con código 1 al no encontrar credenciales; no se intentó una conexión remota.
- `npm audit --omit=dev` reportó 2 vulnerabilidades moderadas asociadas a `uuid` vía Sequelize 6; no se aplicó la corrección sugerida que implica cambiar a una versión principal antigua e incompatible.
- Se comprobó la configuración local de MySQL Workbench y se completó el usuario de conexión en `backend/.env`; host y puerto locales ya figuraban en el archivo. El usuario confirmó que la base se llama `portal_rrhh`, coincidiendo con la configuración. `npm run db:mysql:verify` informó que faltan credenciales, por lo que no se ha verificado la conexión.
- Tras configurar la contraseña local, `npm run db:mysql:verify` confirmó conexión con MySQL 8.0.43. Se inspeccionó `portal_rrhh` y se comprobó que estaba vacía antes de ejecutar `npm run db:migrate`; la migración y el seeder finalizaron correctamente.
- Se verificaron en MySQL 50 colaboradores y 50 usuarios ficticios, 6 departamentos, 12 puestos, 30 solicitudes, 6 incapacidades, 62 movimientos, 24 pagos, 40 evaluaciones y 20 consultas de chat. Se observaron 12 claves foráneas y ningún registro huérfano en las relaciones de colaboradores con usuarios, departamentos y puestos.
- Se verificaron movimientos de ingreso y ascenso en septiembre, octubre y noviembre de 2026, además de salidas en noviembre; las solicitudes contienen 10 pendientes, 10 aprobadas y 10 rechazadas.
- Se generó una contraseña temporal en memoria para el seeder; no se guardó ni se mostró. Para acceder a una cuenta ficticia deberá establecerse una contraseña con `npm run user:set-password`.

## Errores e incidencias

- El daemon de Docker no está en ejecución, por lo que no está disponible para contenedores locales actualmente.
- El entorno aislado no puede leer `C:\Users\HP8D8\.docker\config.json`; no se modificó ese archivo.
- En la fase anterior no había `DATABASE_URL` ni cliente `psql`; esa configuración ya no es necesaria para los datos administrativos.
- MySQL local ya está conectado y poblado con datos ficticios. Las credenciales de Supabase siguen ausentes, por lo que sus índices, RPC, RLS e inserción y recuperación de embeddings aún no están verificados en un servicio real.
- Si se ejecutaron los scripts PostgreSQL históricos en un proyecto Supabase, su posible contenido administrativo debe revisarse con el usuario. No se eliminaron datos remotos.
- Las pruebas de login y permisos no se han ejecutado contra PostgreSQL/Supabase real; tampoco se ha validado la migración de RLS en esa instancia.
- La publicación hacia GitHub no se realizó: el entorno requiere autorización explícita antes de exportar los archivos del proyecto al remoto.
- El sitio oficial de PRODHAB respondió 403 desde el entorno de investigación. Se dejó constancia de la limitación y se verificó el objetivo de la Ley N.° 8968 mediante SCIJ/PGR; no se inventó contenido de PRODHAB.
- No se recibió ni se encontró en el repositorio el enunciado académico o banco de preguntas contra el cual realizar una cobertura literal; se documentó este pendiente en el informe.
- No se recibió el catálogo académico de campos de las tablas; se usaron campos operativos derivados de las políticas y se documentó el supuesto en `database/README.md` y el ERD.

## Pendientes

- Esperar autorización antes de iniciar una nueva fase o modificar el corpus documental.
- Contrastar las políticas contra el enunciado académico cuando sea suministrado.
- Revisar la versión vigente de las normas y los trámites de PRODHAB con asesoría legal antes de una publicación o uso real.
- Completar las credenciales de Supabase en `backend/.env`, aplicar sus scripts en una instancia de desarrollo y probar conexión, permisos y búsqueda vectorial real.
- Revisar el aislamiento, contenido y permisos reales de Supabase y confirmar que no contiene datos personales; una clave privilegiada puede omitir RLS.
- Configurar las cuentas dedicadas MySQL, asignar contraseñas bcrypt y ejecutar pruebas de integración con usuarios ficticios de ambos roles.
- Contrastar el esquema con el catálogo de campos académico cuando sea suministrado y crear migraciones no destructivas si hay diferencias.
- Continuar con la lógica completa de agentes solo después de recibir autorización.
- Publicar los commits locales en `origin/main` únicamente si se autoriza expresamente.
