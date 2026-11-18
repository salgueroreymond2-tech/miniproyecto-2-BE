# Progreso del proyecto

**Última actualización:** 18 de noviembre de 2026<br>
**Fase actual:** Portal frontend de Recursos Humanos.<br>
**Estado:** Implementados los portales autenticados por rol, vistas de colaborador, directorio RRHH y asistente conversacional integrado con la API. Build y pruebas frontend pasaron. Las pruebas end-to-end contra MySQL y DeepSeek quedan limitadas por la configuración de lectura y la disponibilidad del proveedor.

## Fase: Portal frontend de Recursos Humanos (18 de noviembre de 2026)

### Tareas completadas

- Se inspeccionaron frontend, contratos del backend, `AGENTS.md`, README y progreso. Se conservó la identidad existente de NexoTico Servicios Tecnológicos, S.R.L.
- Se implementó un sistema visual responsive con tokens centralizados de color y tipografía, Manrope e Inter, Google Material Symbols, foco visible, estados reducidos de animación y breakpoints para escritorio, tablet y móvil.
- Se construyeron sidebar colapsable, barra superior, footer, botones, cards, inputs, selector, tabla, badges, modal accesible, tooltips, notificaciones, skeletons, estados vacíos y errores reutilizables.
- Se perfeccionó el login con validación de correo, estados de carga y error, mostrar/ocultar contraseña y navegación según el rol. La autenticación continúa a través de Express/JWT.
- Se conserva el JWT en `sessionStorage`, con restauración mediante `/api/auth/me` tras recargar la pestaña y limpieza al cerrar sesión o recibir un 401.
- Se implementaron Inicio, Perfil, Vacaciones, Solicitudes, Pagos y Asistente del colaborador, además del directorio de colaboradores para RRHH. Los datos se obtienen exclusivamente mediante el cliente Axios y los endpoints existentes.
- El asistente restaura conversaciones desde MySQL, crea conversaciones, presenta sugerencias, envía consultas sin simular streaming, muestra fuente y citas, abre únicamente enlaces Google Drive/Docs seguros y renderiza Markdown sin insertar HTML. Tiene copia, manejo de errores y reintentos con la misma clave idempotente.
- Se ajustó el repositorio backend para que un reintento de una consulta que terminó con error reutilice su fila idempotente en MySQL en vez de duplicar el registro.

### Pruebas y verificaciones

- `frontend/npm test`: 13 de 13 pruebas pasaron. Cubren login/redirección por rol, sesión restaurada y vencida, navegación protegida, llamadas personales, historial, chat, citas, sanitización de Markdown, consulta personal y reintento.
- `frontend/npm run build`: Vite compiló correctamente; 112 módulos transformados.
- `backend/npm test`: 66 pruebas pasaron; 3 integraciones condicionadas por entorno quedaron omitidas; no hubo fallos. Incluye prueba de reintento idempotente sin crear otra fila.
- `git diff --check` terminó sin errores de whitespace.

### Límites de verificación

- Los flujos de API del frontend se probaron con respuestas HTTP aisladas; no se ejecutó login/chat real contra DeepSeek o perfil real con la cuenta del navegador.
- La cuenta MySQL de solo lectura (`DB_READ_USER`/`DB_READ_PASSWORD`) sigue pendiente, por lo que no se pudo comprobar historial, directorio y consultas personales de extremo a extremo en la base real.
- El entorno no ofrece un navegador automatizado para capturas de escritorio/tablet/móvil; se verificó el build y se aplicaron breakpoints CSS, sin afirmar una inspección visual en dispositivo.

---

## Historial de fases anteriores

## Fase anterior: Orquestador de chat (18 de noviembre de 2026)

### Tareas completadas

- Se implementó `backend/src/services/orchestrator.agent.js` con clasificación estructurada de DeepSeek y validación Zod para las seis intenciones, temas permitidos, nivel de confianza y solicitud de aclaración.
- Se enrutan preguntas de políticas al agente RAG, preguntas personales al agente de datos, y las consultas mixtas ejecutan ambos agentes en paralelo. Se preservan directamente los números, fragmentos y citas de sus fuentes.
- Se aplican las restricciones de datos personales y reportes en el backend; no se aceptan decisiones de autorización del modelo. Se rechazan preguntas sobre vacaciones de terceros y salarios individuales. Reportes de RRHH quedan preparados para la fase futura del analista, sin implementarlo.
- Se añadió el prompt versionado `backend/src/prompts/orchestrator.prompt.v1.md`. El contexto de clasificación se limita a los últimos tres temas e intenciones de la conversación autenticada.
- Se creó la entidad Sequelize `Conversacion` y una migración no destructiva. Se añadieron a `consultas_chat` la intención, tema, agentes utilizados, fragmentos, documentos, citas, estado de escalamiento, colaborador e identificador de idempotencia.
- Se implementó persistencia idempotente y aislamiento de historial por `usuario_id` validado desde JWT. Los reintentos con el mismo identificador devuelven la respuesta guardada sin volver a llamar a DeepSeek ni a los agentes.
- Se consolidó el endpoint anterior `/api/chat/employee-data` en el punto central `/api/chat`; se retiraron su ruta y controlador para no duplicar endpoints. Las rutas de historial, lista de conversaciones y detalle también usan JWT y validan propiedad en MySQL.
- Se documentaron los contratos en Swagger y se actualizaron el ERD y los permisos MySQL de los roles de API y solo lectura.

### Pruebas y verificaciones

- `npm test`: 65 pruebas pasaron y 3 integraciones condicionadas por entorno quedaron omitidas; no hubo fallos.
- Los casos obligatorios verifican la denegación de datos del compañero Juan y del salario del gerente, la consulta mixta en paralelo, la ausencia de invención para un beneficio inexistente y el rechazo de una pregunta fuera de alcance.
- También se probaron reportes con los roles COLABORADOR y RRHH, baja confianza, validación Zod, JWT, rutas, propiedad de conversaciones, aislamiento entre dos usuarios e idempotencia.
- `npm run db:migrate` aplicó correctamente `20261118000100-add-orchestrator-conversations` en MySQL. `npx sequelize-cli db:migrate:status` confirmó las ocho migraciones aplicadas.

### Pendientes y límites conocidos

- Configurar `DB_READ_USER` y `DB_READ_PASSWORD` para probar en vivo el historial y los agentes personales con permisos mínimos; esta fase no sustituyó las credenciales de solo lectura con las de escritura.
- La clasificación del modelo se validó con pruebas del servicio estructurado usando un transporte simulado; no se registró una llamada real a DeepSeek durante esta fase.
- El endpoint anterior de datos personales deja de estar disponible; el contrato consolidado es `POST /api/chat`.

---

## Historial de fases anteriores

## Fase: Agente de datos personales del colaborador (18 de noviembre de 2026)

### Tareas completadas

- Se creó backend/src/services/employee-data.agent.js con selección estructurada de herramientas mediante el servicio oficial existente de DeepSeek. DeepSeek recibe la pregunta y el menú permitido, nunca filas ni expedientes personales de MySQL.
- Se creó backend/src/repositories/employeeDataRepository.js con seis consultas Sequelize independientes. Todas resuelven el colaborador mediante el usuario autenticado y usan exclusivamente getReadConnection() (DB_READ_USER/DB_READ_PASSWORD).
- Las consultas limitan atributos sensibles; no consultan ni devuelven salario, contraseña, hash, referencia de incapacidad ni expediente completo. El estado de una solicitud siempre filtra simultáneamente por su ID y el colaborador propio.
- Se añadió POST /api/chat/employee-data, protegido por JWT, límite de consultas, esquema Zod estricto y documentación Swagger. El cuerpo acepta únicamente question; los IDs enviados por el cliente se rechazan.
- Se creó backend/src/prompts/employee-data.prompt.md. Las respuestas numéricas y fechas se componen en el backend desde resultados de MySQL, llevan Fuente de datos: MySQL. y no fabrican citas documentales (citations: []).
- Para evaluaciones, el modelo existente no tiene una fecha de programación separada: se usa el inicio del período futuro pendiente más cercano como referencia, sin crear campos ni modificar tablas.
- Se agregó una integración MySQL de solo lectura que compara resultados con consultas Sequelize directas y prueba el aislamiento de dos colaboradores.

### Decisiones técnicas

- Se reutilizan los modelos actuales y la conexión getReadConnection(); no se crearon tablas, modelos duplicados ni acceso SQL generado por IA.
- Los UUID de solicitudes se aceptan para getRequestStatus únicamente si están explícitos en la pregunta; la consulta vuelve a filtrar por el colaborador autenticado. Si el ID falta o el estado singular es ambiguo, se pide aclaración.
- En ausencias se incluyen incapacidades propias y permisos/licencias/vacaciones aprobados; se excluyen las referencias CCSS. No se transmite ningún resultado del repositorio a DeepSeek.

### Pruebas y verificaciones

- node --test test/employee-data-agent.test.js test/employee-data.mysql.integration.test.js: 11 pruebas aisladas pasaron y 1 integración MySQL quedó omitida por falta de credenciales de solo lectura.
- npm test: 51 pruebas pasaron, 3 integraciones condicionadas por entorno quedaron omitidas y no hubo fallos.
- node --check pasó para los archivos nuevos de agente, repositorio, rutas, controlador y pruebas.
- git diff --check no encontró errores de whitespace; Git reportó avisos de conversión LF/CRLF que no afectaron las pruebas.
- Se intentó una llamada de humo a DeepSeek con una pregunta sintética no personal; el entorno devolvió DEEPSEEK_NETWORK_ERROR (sin respuesta HTTP). Las pruebas locales validan la selección con un proveedor simulado.
- No se compararon resultados contra MySQL en vivo: backend/.env no tiene DB_READ_USER ni DB_READ_PASSWORD. No se usó la cuenta de escritura como sustituto.

### Pendientes

- Configurar una cuenta MySQL dedicada con privilegios SELECT en DB_READ_USER y DB_READ_PASSWORD, y ejecutar MYSQL_EMPLOYEE_INTEGRATION=1 node --test test/employee-data.mysql.integration.test.js.
- Repetir la prueba real de selección estructurada cuando el entorno permita llegar al endpoint oficial de DeepSeek.

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
- Decisión vigente: MySQL 8 con Sequelize/mysql2 almacena los datos administrativos y los fragmentos documentales. Los módulos y scripts PostgreSQL/Supabase anteriores fueron retirados del árbol y permanecen en Git.
- La tabla activa `document_chunks_e5` acepta únicamente embeddings de `Xenova/multilingual-e5-small` con 384 dimensiones en JSON. Los vectores anteriores permanecen separados en `document_chunks` y no participan en la búsqueda. La similitud coseno se calcula de forma exacta en el backend, por lotes.
- DeepSeek es el proveedor de generación. E5 se ejecuta localmente con los prefijos `query:` y `passage:`, mean pooling, normalización, calentamiento y reutilización de una sola carga del modelo.
- El JWT pertenece a la API Express; cada petición autenticada consulta el estado y rol actual del usuario. El frontend no consulta tablas directamente.
- El límite de login se guarda en memoria por instancia; para despliegue con varias instancias se requiere un almacén compartido y configuración de proxy revisada.
- Se creó `backend/.env` a petición del usuario; permanece excluido de Git. La conexión MySQL local está configurada sin registrar ni mostrar su contraseña.
- Se configuró `GOOGLE_DRIVE_FOLDER_ID` con el identificador de la carpeta proporcionada y `GOOGLE_APPLICATION_CREDENTIALS` con una ruta local fuera del repositorio. La cuenta de servicio usa exclusivamente el alcance `drive.readonly`; la autenticación y el acceso de lectura a la carpeta se verificaron sin mostrar ni almacenar la clave en el repositorio.
- Se definieron 15 modelos Sequelize, migración MySQL, seeder de demostración, repositorios parametrizados y una conexión separada de solo lectura.
- Se prepararon los cinco scripts de Supabase, RPC de búsqueda coseno y publicación atómica de versiones completas, y servicios de vectores y embeddings.
- Se sustituyó el almacén vectorial externo por `document_chunks` en MySQL, con clave foránea hacia `documentos`, publicación transaccional y consultas que excluyen contenido pendiente o inactivo. Los scripts de Supabase preparados anteriormente quedaron obsoletos y se retiraron.
- Se implementaron `deepseek.service.js` y el servicio local `embedding.service.js`, se retiró el SDK anterior de Gemini y se instaló `@huggingface/transformers`. La configuración de `backend/.env` se agrupó y se retiraron campos anteriores vacíos sin mostrar ni alterar la clave proporcionada.
- Se implementó `ingestion.agent.js` para PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets, con extracción local, secciones, chunks por tokenización E5, prefijo `passage:` y control del límite de 512 tokens incluyendo tokens especiales.
- Se implementó `policies.agent.js` y su prompt independiente: embedding E5 local, recuperación de los cinco fragmentos activos con similitud coseno en Node.js, umbral configurable, generación estructurada con DeepSeek, validación de IDs citados y citas construidas desde metadatos de MySQL.
- El agente de políticas solo consulta fragmentos/documentos validados y activos; escribe pregunta, respuesta, resolución, latencia, IDs de fragmentos utilizados y documentos citados en `consultas_chat`, más el resultado en `logs_agentes`. No consulta tablas de colaboradores, usuarios, salarios ni incapacidades.
- La ingesta solo indexa documentos cuyo hash exacto fue aprobado por RRHH, con fuentes oficiales de Costa Rica y atestación de revisión sin datos personales. La detección automática de PII es una barrera adicional, no una garantía; el contenido de documentos no aprobados no se guarda en fragmentos.
- Se añadieron `changes.list`, control de nuevas modificaciones y eliminaciones, persistencia de sincronizaciones, escrituras transaccionales MySQL y revisión de caché vectorial mediante `vector_cache_state.revision`.
- Se agregaron endpoints RRHH para candidatos, aprobaciones, piloto de un documento, sincronización incremental y estado, más Swagger y una migración no destructiva para datos de revisión normativa.
- Se aplicó la migración `20261117000400-create-e5-document-chunks` en MySQL sin eliminar o modificar la tabla anterior de vectores.
- La migración `20261117000700-add-policy-agent-audit` añade los campos de resolución, latencia, fragmentos usados y documentos citados al historial de chat; es compatible con instalaciones existentes y con el esquema inicial actualizado. Se aplicó correctamente en MySQL.
- Markdown es la fuente de verdad para recuperación RAG; los PDF y DOCX son copias de distribución y la matriz XLSX permite importación estructurada en Google Sheets.
- Las obligaciones legales verificadas se mantienen separadas de las reglas internas ficticias de NexoTico para evitar que el sistema RAG confunda una política corporativa con un derecho legal.
- El pipeline de Drive excluye documentos con posibles datos personales, incluso si fueron aprobados normativamente; RRHH debe revisar el archivo y atestar que no contiene datos personales antes de aprobar su hash.

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
- La nueva migración `20261117000300-create-document-chunks` se aplicó en MySQL local. Una prueba de integración con datos ficticios dentro de una transacción comprobó inserción idempotente, bloqueo de publicación incompleta, publicación completa, recuperación por similitud y protección frente al borrado de fragmentos activos; los datos de prueba se revirtieron.
- La prueba real detectó un defecto previo de campos compartidos en las definiciones de Sequelize. Se corrigió creando definiciones independientes por columna y la prueba volvió a pasar.
- Tras la integración se confirmó que permanecen 50 colaboradores y 50 usuarios y que no quedaron documentos ni fragmentos de prueba. `npm test` del backend pasó 12 pruebas aisladas (1 integración omitida en la ejecución predeterminada); la integración MySQL se ejecutó aparte y pasó. El frontend pasó 3 pruebas y su compilación de producción.
- DeepSeek: el primer intento real de consulta a `/models` devolvió HTTP 401; tras la corrección de la clave por el usuario, `/models` y `/chat/completions` respondieron HTTP 200. `deepseek-flash` apareció disponible y la respuesta JSON cumplió el esquema de prueba; la latencia de la generación fue 1237 ms en esa ejecución.
- E5: se descargó el modelo público a una caché local excluida de Git y se generaron embeddings reales normalizados de 384 dimensiones para una pregunta y un pasaje ficticios; su similitud coseno fue aproximadamente 0.878. La repetición con la caché local también pasó.
- La prueba `mysql-e5-real.integration.test.js` generó embeddings E5 reales, almacenó un fragmento ficticio, publicó la versión y lo recuperó mediante búsqueda MySQL; revirtió todos los datos de prueba. También pasó la prueba MySQL de versiones y filtrado.
- `npm test` del backend pasó 16 pruebas y omitió las 2 integraciones de MySQL por defecto; ambas integraciones se ejecutaron por separado y pasaron.
- Después de las pruebas se confirmó que permanecen 50 colaboradores y 50 usuarios y que ambas tablas de fragmentos contienen cero filas; el contenido ficticio se revirtió y el corpus real aún no se ha ingerido.
- La verificación real con `listCandidates()` autenticó contra Drive con el alcance `drive.readonly` y recorrió la carpeta y sus subcarpetas; encontró cero archivos. No se descargó ni se ingirió contenido.
- La creación del cliente JWT de Drive usa el JSON validado en memoria y evita la opción de credenciales deprecada; la comprobación real terminó sin advertencias de deprecación.
- `node --test test/ingestion-agent.test.js` pasó 5 de 5 pruebas después del ajuste de autenticación.
- Las pruebas del agente cubren vacaciones, aguinaldo, permisos, incapacidades, teletrabajo, política inexistente, prompt injection, validación de citas, umbral, límite de cinco fragmentos y auditoría de errores.
- `npm test` del backend pasó 22 pruebas y omitió las 2 integraciones MySQL condicionadas por entorno; incluyó pruebas de extracción de formatos, chunking, aprobaciones, exclusión, detección incremental y autorización RRHH.
- Se validó la extracción local de PDF, DOCX y XLSX con el corpus ficticio y se comprobó que el tokenizador E5 en caché carga sin acceso remoto.
- Las dos integraciones MySQL ejecutadas por separado pasaron: vectorización E5 real y publicación/búsqueda transaccional. `db:migrate:status` confirmó todas las migraciones aplicadas; las tablas de documentos, fragmentos E5, estado Drive y aprobaciones quedaron en cero registros tras las pruebas.
- Se tokenizaron localmente los diez PDF ficticios: nueve cumplen 350–450 tokens en todos sus fragmentos; una política requiere un fragmento final de 90 tokens porque su longitud no permite cubrirla íntegra con fragmentos de 350–450 y solapamiento de 50–80. En todos los casos el máximo prefijado fue 454 tokens y el detector no encontró patrones de PII.
- La migración del historial de políticas quedó aplicada y `db:migrate:status` la confirmó. La última ejecución de `npm test` pasó 36 pruebas y omitió las 2 integraciones MySQL condicionadas por entorno; incluyó las cinco consultas temáticas, la política inexistente, el umbral, las cinco citas máximas, la validación anti-injection, la auditoría simulada y la compatibilidad de la migración.
- En la revisión del agente visual se corrigió el flujo de aprobación: ahora exige atestación separada de revisión normativa y de ausencia de datos personales, y se aplica mediante la migración `20261117000800-require-normative-review` en MySQL.
- `POST /api/admin/ingestion/pilot` exige el ID de un documento elegido y procesa solo ese archivo; no consume el cursor de cambios. Después de revisarlo, la sincronización completa recorre los restantes, consume `changes.list` e inspecciona el árbol para detectar documentos bajo carpetas movidas o eliminadas. Antes de insertar fragmentos se vuelve a comprobar la versión de Drive.
- La extracción PDF conserva el número de página para las citas. DOCX conserva sus encabezados como Markdown y DOCX/XLSX se inspeccionan como ZIP antes de extraerse, con límites de tamaño expandido, entradas y razón de compresión.
- El embedding E5 comprueba el tokenizador real contando el prefijo y tokens especiales; rechaza entradas de más de 512 tokens sin truncarlas. La búsqueda coseno de MySQL usa una caché acotada por revisión persistida; publicaciones e ingestas incrementan esa revisión dentro de sus transacciones y limpian la caché local al confirmar.
- El agente de políticas publica únicamente citas textuales que aparecen de forma literal en cada fragmento citado. Si DeepSeek devuelve una paráfrasis o una cita no verificable, responde que no hay evidencia suficiente.
- `npm test` pasó 40 pruebas y omitió 2 integraciones condicionadas por entorno. Por separado pasaron `test/mysql-vector.integration.test.js` y `test/mysql-e5-real.integration.test.js`, esta última con embeddings E5 reales y verificación del límite de 512 tokens.
- Se aplicó en MySQL la migración `20261117000800-require-normative-review`; la integración vectorial comprobó la caché por revisión y revirtió sus datos de prueba.
- Se verificó de nuevo la cuenta local de Drive: el correo coincide con `policybot-drive-reader@acme-509515.iam.gserviceaccount.com`, el alcance usado es `drive.readonly` y el listado recursivo devolvió cero archivos. No se descargó contenido, no se registraron aprobaciones ni se ejecutó el piloto.

## Errores e incidencias

- El daemon de Docker no está en ejecución, por lo que no está disponible para contenedores locales actualmente.
- El entorno aislado no puede leer `C:\Users\HP8D8\.docker\config.json`; no se modificó ese archivo.
- En la fase anterior no había `DATABASE_URL` ni cliente `psql`; esa configuración ya no es necesaria para los datos administrativos.
- El corpus de políticas aún no se ha ingerido en `document_chunks_e5`; las pruebas reales utilizaron contenido ficticio transitorio. La similitud mínima de RAG debe calibrarse con preguntas evaluadas.
- La carpeta de Drive y sus subcarpetas no devolvieron archivos; no se pudo ejecutar el piloto ni validar documentos. No se descargó ni cargó contenido.
- Las pruebas de políticas usaron fragmentos ficticios aislados y DeepSeek simulado; no se verificó la corrección legal contra documentos aprobados ni se hizo una llamada real al proveedor, porque el corpus de Drive está vacío.
- La auditoría `npm audit --omit=dev` no pudo consultar el endpoint de npm desde este entorno; no se obtuvo un informe actual de vulnerabilidades de dependencias.
- Si se ejecutaron los scripts PostgreSQL históricos en un proyecto Supabase, su posible contenido administrativo debe revisarse con el usuario. No se eliminaron datos remotos.
- Las pruebas de login y permisos todavía no se han ejecutado de extremo a extremo contra cuentas MySQL reales.
- La publicación hacia GitHub no se realizó: el entorno requiere autorización explícita antes de exportar los archivos del proyecto al remoto.
- El sitio oficial de PRODHAB respondió 403 desde el entorno de investigación. Se dejó constancia de la limitación y se verificó el objetivo de la Ley N.° 8968 mediante SCIJ/PGR; no se inventó contenido de PRODHAB.
- No se recibió ni se encontró en el repositorio el enunciado académico o banco de preguntas contra el cual realizar una cobertura literal; se documentó este pendiente en el informe.
- No se recibió el catálogo académico de campos de las tablas; se usaron campos operativos derivados de las políticas y se documentó el supuesto en `database/README.md` y el ERD.

## Pendientes

- Colocar los documentos que se desean evaluar en la carpeta de Drive o en sus subcarpetas. La clave local ya está configurada y la cuenta de servicio tiene acceso de lectura.
- Cuando haya candidatos, RRHH debe revisar por hash cada documento, confirmar la revisión normativa con fuentes oficiales y atestar que no contiene datos personales; ejecutar `/api/admin/ingestion/pilot`, verificarlo y luego `/api/admin/ingestion/sync` para procesar los restantes.
- Contrastar las políticas contra el enunciado académico cuando sea suministrado.
- Revisar la versión vigente de las normas y los trámites de PRODHAB con asesoría legal antes de una publicación o uso real.
- Revisar el contenido documental antes de una futura ingesta para impedir datos personales y calibrar el umbral de búsqueda con el banco de preguntas.
- Configurar las cuentas dedicadas MySQL, asignar contraseñas bcrypt y ejecutar pruebas de integración con usuarios ficticios de ambos roles.
- Contrastar el esquema con el catálogo de campos académico cuando sea suministrado y crear migraciones no destructivas si hay diferencias.
- Implementar los agentes restantes solo después de recibir autorización explícita.
- Publicar los commits locales en `origin/main` únicamente si se autoriza expresamente.
