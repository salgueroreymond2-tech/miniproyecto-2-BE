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

## Fase analista de reportes — 2026-11-18

### Completado

- Se implementó `backend/src/services/analyst.agent.js` con agregaciones parametrizadas vía Sequelize/MySQL para dotación, ausencias, solicitudes, incapacidades, movimientos, rotación, vacaciones y uso del chatbot. Las ausencias y la tendencia cuentan personas distintas por día para evitar duplicados.
- El contrato JSON del reporte se valida con Zod e incluye los indicadores, las filas pendientes para la tabla histórica, distribuciones y series para gráficos. Los límites del chatbot corresponden al día local anterior de `America/Costa_Rica`; períodos vacíos producen ceros o latencia `null`, según corresponde.
- La tasa acumulada anual se documentó como salidas distintas acumuladas divididas entre la dotación promedio entre inicio de año y fecha de reporte. El resto de definiciones, períodos y decisiones de conteo está en `docs/reports.md`.
- DeepSeek recibe datos agregados y elige entre identificadores permitidos de frases construidas en backend con valores de SQL. Por eso no puede cambiar ni inventar cifras. Si la respuesta estructurada es inválida o el proveedor falla, el agente guarda un resumen determinista marcado `SQL_FALLBACK`.
- Los reportes se almacenan por fecha en `reportes_diarios`; lecturas de último, historial y fecha específica usan únicamente lo almacenado. El `POST` manual devuelve el reporte ya existente de ese día si se llama otra vez.
- Se añadieron `node-cron`, las tareas de sincronización de Drive a las 06:00 y reporte a las 07:00, recuperación de ejecuciones faltantes al arrancar y registro idempotente de resultados y errores en `trabajos_programados`.
- Se protegieron todos los endpoints `/api/reports/*` con JWT y rol `RRHH`, se documentaron en Swagger y se integró `REPORTE` del orquestador para contestar indicadores desde el JSON persistido o pedir precisión si la métrica no se reconoce.
- Se alineó el SQL base con las columnas de memoria conversacional usadas por el agente y se añadieron índices para las agregaciones diarias.
- La migración `20261118000200-create-scheduled-job-runs` y los índices se aplicaron a MySQL. `db:migrate:status` confirmó todas las migraciones aplicadas.
- `npm test -- --test-reporter=dot` terminó correctamente, con cero fallidas y cuatro omitidas por dependencias de integración del entorno. Las pruebas nuevas cubren fórmulas, ceros, fallback, autorización RRHH, persistencia por fecha simulada, consultas al JSON guardado, migración idempotente, recuperación y registro cron.

### Incidencias y límites de verificación

- La cuenta dedicada `DB_READ_USER`/`DB_READ_PASSWORD` no está configurada. Se mantuvo el requisito de solo lectura y no se usaron credenciales de escritura para validar indicadores. La prueba de comparación contra SQL independiente quedó preparada y se omitió con una razón explícita; no se afirma una validación de cifras reales.
- La integración real que combina MySQL de solo lectura con el resumen de DeepSeek no se pudo ejecutar por esa cuenta ausente. La ruta del resumen y la respuesta de respaldo se verificaron con dobles controlados; el proveedor no recibió una llamada para generar un reporte real en esta fase.
- npm reportó ocho vulnerabilidades moderadas durante la instalación de `node-cron`; no se ejecutó una actualización general de dependencias.

### Pendiente

- Configurar `DB_READ_USER` y `DB_READ_PASSWORD` con permisos `SELECT` y ejecutar `node --test test/analyst.mysql.integration.test.js` para contrastar los indicadores contra el contenido real de MySQL.
- Hacer una generación manual en un entorno con la cuenta de solo lectura configurada y validar el resumen real, los datos almacenados y la respuesta de los endpoints.

## Panel administrativo de RRHH — 2026-11-18

### Completado

- Se amplió el layout existente con ocho vistas administrativas protegidas en React Router: dashboard general, colaboradores, departamentos, solicitudes, documentos indexados, sincronizaciones, actividad del chatbot e historial de reportes.
- El dashboard consulta `/api/reports/latest`, `/api/reports/history` y `/api/reports/:date`. Las ocho tarjetas KPI, los cuatro gráficos Recharts, el resumen ejecutivo, la fecha/origen del reporte y las preguntas RAG sin evidencia se presentan desde snapshots persistidos en MySQL; el cliente no recalcula métricas ni llama a DeepSeek.
- Se incorporó un componente común de tabla para búsqueda, filtros, ordenamiento, paginación y estados vacíos. Las solicitudes pendientes de más de tres días se resaltan; el historial permite abrir reportes y consultar la lista de solicitudes pendientes guardada con cada snapshot.
- Se añadió la consulta documental de RRHH con título, categoría, versión, indexación, cantidad de fragmentos, estado y enlace seguro a Google Drive. La sincronización usa el endpoint existente protegido, confirma la acción y no elimina originales.
- Se añadieron rutas de solo lectura `/api/admin/departments`, `/api/admin/requests`, `/api/admin/documents` y `/api/admin/synchronizations`. Usan la conexión MySQL de lectura, parámetros y filtros de orden permitidos, validación Zod y autorización `RRHH`; Swagger documenta los contratos.
- Se conservaron los tokens y componentes existentes, se añadieron estilos responsive para el dashboard, gráficos, tablas y estados administrativos, y se cargan las páginas bajo demanda para separar Recharts del paquete inicial.
- Las pruebas frontend recorren la autenticación por rol, las vistas administrativas, el selector de fechas, el resaltado de solicitudes vencidas y la confirmación de sincronización. Las rutas backend comprueban JWT, exclusividad RRHH, validación de filtros y consultas parametrizadas.
- `npm test` del frontend pasó 14 pruebas. `npm run build` compiló correctamente; Vite generó un paquete inicial de 373.82 kB y un módulo de gráficos de 478.07 kB, sin advertencia de chunk grande.
- `npm test` del backend pasó 83 pruebas y omitió 4 integraciones condicionadas por la cuenta/servicios del entorno. Las pruebas nuevas de consultas administrativas pasaron 3 de 3.

### Incidencias y límites de verificación

- La comparación de indicadores con MySQL real continúa omitida porque no está configurada la cuenta `DB_READ_USER`/`DB_READ_PASSWORD`. Por ello no se afirma que las vistas se hayan probado contra datos reales en esta ejecución; en producción, las rutas mostrarán el error del servicio en vez de sustituirlo por datos de ejemplo.
- No se ejecutó una sincronización real de Google Drive. La acción se probó mediante el endpoint simulado por el test frontend y el endpoint conserva la protección existente del agente de ingesta.

### Pendiente

- Configurar la cuenta MySQL de solo lectura y verificar visualmente las ocho vistas con los registros reales del entorno.

## Auditoría QA, seguridad y evaluación — 2026-11-18

### Completado

- Se leyó `AGENTS.md`, este archivo, `README.md` y se inspeccionaron los agentes, rutas, repositorios, configuración, pruebas y políticas. Se buscaron la guía académica y el banco en el repositorio y los adjuntos disponibles; no se encontraron. `documents/research/informe-investigacion-rrhh-costa-rica` es un informe de fuentes, no el enunciado académico.
- Se comprobó la estructura de cinco agentes independientes: orquestador, políticas RAG, datos personales, analista e ingesta/sincronización. Los cuatro agentes generativos tienen instrucciones separadas; ingesta es determinista y contiene sus reglas en el módulo y esquemas. No se añadió un prompt sin consumidor.
- La revisión del runtime confirma Sequelize/mysql2 y tablas MySQL como almacenamiento persistente activo. Las búsquedas de PostgreSQL/Supabase/pgvector no encontraron driver activo; las referencias antiguas encontradas son históricas/documentales.
- La suite backend terminó con **83 aprobadas, 0 fallidas y 4 omitidas** (87 casos; 27,236 ms). Una ejecución del frontend en paralelo con otras tareas tuvo un timeout en la prueba de redirección RRHH; al repetir la prueba afectada aislada y la suite completa aislada, ambas pasaron (**14 aprobadas, 0 fallidas**). No se modificó código por un fallo no reproducible. El build Vite compiló 520 módulos correctamente (build final: 3.92 s).
- `npm run db:mysql:verify` autenticó la cuenta de aplicación. La cuenta separada `DB_READ_USER`/`DB_READ_PASSWORD` continúa ausente; no se consultaron datos personales, agregados, filas ni reportes con la cuenta de escritura.
- `npm run ai:verify-embeddings` cargó el modelo local E5 y generó un vector normalizado de 384 dimensiones. La similitud del texto técnico de demostración fue 0.8778786413679619; esto no mide calidad de recuperación documental.
- `npm run ai:verify-deepseek` terminó con `DEEPSEEK_NETWORK_ERROR`, sin estado HTTP (713 ms para la comprobación de disponibilidad). La clave no se clasificó como inválida ni se imprimió. La verificación unitaria del cliente sigue usando respuesta simulada.
- La consulta metadata-only de Drive quedó bloqueada por `EACCES`; no se descargaron documentos ni se ejecutó sincronización. La última ejecución recursiva exitosa documentada, del 17 de noviembre, autenticó con alcance `drive.readonly` y encontró cero archivos.
- Se consultaron fuentes oficiales de teletrabajo y normas de incapacidades. Se corrigió NT-PC-03 v1.1 para distinguir el aviso formal y el trámite específico de cinco días para constancias de médicos de empresa. Se corrigió NT-PC-04 v1.1 para incluir la reforma de teletrabajo en el extranjero (Ley N.° 10673) y separar la condición interna ficticia de una prohibición legal general. Los PDF/DOCX de estas políticas y la matriz XLSX se regeneraron; RRHH debe revisar/atestiguar las versiones antes de ingerirlas.
- Se crearon `docs/evaluation.csv` con 25 IDs originales reservados sin texto inventado y 20 preguntas propias con expectativas fijadas; `docs/test-results.md`; `docs/security-audit.md`; y `docs/requirements-checklist.md`. Cuatro controles propios muestran aprobación unitaria; uno es parcial. Los demás quedan explícitamente bloqueados por ausencia de corpus/conexión o guía.

### Errores, incidencias y límites

- No se pudo extraer/calificar las 25 preguntas originales ni identificar literalmente Q21/Q22 sin la guía académica. Las consultas de compañero Juan y salario del gerente pasaron sus pruebas unitarias como casos propios, no como preguntas académicas confirmadas.
- El conteo actual de colaboradores, cobertura de tres meses, calidad de reportes y aislamiento de datos contra MySQL no se verificaron; falta la cuenta de lectura. El historial contiene ejecuciones previas de datos semilla, que no reemplazan este conteo actual.
- La carpeta de Drive estaba vacía en el último listado exitoso; la comprobación actual de conectividad metadata-only terminó con `EACCES`. No se verificaron cambios reales, formatos alojados en Drive ni citas activas.
- No se obtuvo una respuesta real de DeepSeek en esta ejecución. La exactitud RAG, calibración de umbral, citas documentales vivas, mezcla de agentes, seguimiento E2E y objetivo de latencia no tienen medición real.
- La descarga directa de la normativa CCSS devolvió 403. Se documentó esa limitación en NT-PC-03 y se recurrió a texto oficial SCIJ/PGR disponible; toda excepción/caso individual requiere revisión normativa de RRHH.
- La suite omitió cuatro integraciones condicionadas por configuración y dependencias del entorno. El resultado unitario no se presenta como prueba integral, y no hay base para afirmar cero fugas E2E ni cumplir los objetivos de puntuación académica.
- La ejecución frontend en paralelo presentó un timeout aislado de cinco segundos. La prueba y suite completa pasaron al repetirse aisladas; queda anotado como intermitencia de carga, sin atribuir una causa definitiva.

### Pendientes

- Incorporar la guía académica original para sustituir los IDs ACA-01…ACA-25 por preguntas literales, fijar respuestas esperadas y confirmar Q21/Q22.
- Configurar una cuenta MySQL dedicada con permiso mínimo `SELECT`; ejecutar integraciones de reportes/personas, comprobar 50 colaboradores ficticios y tres meses de movimientos y recorrer el dashboard con ambos roles.
- Restablecer conectividad de Node hacia DeepSeek y Drive; volver a verificar los servicios sin exponer claves. Subir a Drive los documentos legales/políticas revisados, hacer la revisión humana de privacidad y normativa, probar piloto y luego sincronización.
- Ejecutar el banco completo con RAG y datos MySQL activos; medir relevancia, citas, resultados correctos y latencia real. No se declara aprobada la aceptación global hasta que exista esta evidencia.

## Preparación de entrega final — 2026-11-18

### Completado

- Se profesionalizó `README.md` con objetivo, arquitectura, carpetas existentes, instrucciones reales de instalación/ejecución, MySQL, migraciones/seed, DeepSeek, E5, Drive, variables, tests, limitaciones y enlaces a la documentación académica. Se ajustó el árbol para reflejar la ubicación real de los agentes en `backend/src/services/` y del seeder en `backend/seeders/`.
- Se completó `backend/.env.example` con el umbral de confianza del orquestador y los tres interruptores opcionales de pruebas de integración. Una búsqueda de `process.env.*` en runtime y tests quedó cubierta por la plantilla. `backend/.env` y credenciales de servicio están ignorados por Git y no aparecen versionados.
- Se actualizó el informe de investigación independiente a versión 1.1, con ocho páginas verificadas y diez dominios explícitos. Se registraron fuentes oficiales, fecha de consulta (18/11/2026), distinción ley/política ficticia, el artículo 41 aplicable a aviso de incapacidad, el alcance específico de medicina de empresa y la reforma de teletrabajo Ley N.° 10673. Se dejó constancia de las páginas de CCSS/PRODHAB inaccesibles desde el entorno.
- Se preparó `documents/reports/informe-tecnico-portal-rrhh.md` y se amplió el generador documental para producir su DOCX/PDF. El informe técnico tiene nueve páginas verificadas y explica el almacenamiento JSON de E5 en MySQL, coseno en Node.js, ventajas y límites para pequeña escala.
- Se creó `docs/diagrams.md` con siete diagramas Mermaid: arquitectura, ER MySQL, autenticación, multiagente, RAG, Drive y reportes cron.
- Se prepararon `docs/presentation-script.md` (15 minutos y respaldo de cinco minutos), `docs/defense-questions.md` (25 preguntas con respuestas técnicas) y `docs/academic-compliance-matrix.md` con evidencia y estado por requisito.
- La matriz de evaluación conserva 45 filas: 25 IDs académicos bloqueados sin enunciados inventados y 20 preguntas propias; estado documentado: 4 `PASS_UNIT`, 1 `PARTIAL_UNIT`, 40 `BLOCKED`. No se calcula puntuación global.
- `node tools/build-document-formats.js` generó correctamente diez políticas, 25 archivos de distribución, investigación PDF de 8 páginas, informe técnico PDF de 9 páginas y XLSX de 11 hojas. Se comprobaron encabezados/fin de PDF, páginas, estructura ZIP de DOCX/XLSX y `node --check` del generador.
- Se reejecutaron pruebas: backend **83 aprobadas, 0 fallidas y 4 omitidas** (87 casos, 7.82 s); frontend **14 aprobadas, 0 fallidas** (24.51 s); `npm run build` generó 520 módulos (Vite reportó 1.40 s). `docs/test-results.md` registra esta corrida.
- `docs/PROGRESS.md`, `docs/test-results.md`, la matriz y el informe técnico reflejan los resultados de esta tarea. `git diff --check` no encontró errores de whitespace; Git solo advirtió que normalizará LF a CRLF en algunos archivos de texto.

### Límites y pendientes

- No se encontró la guía académica original. Por eso siguen pendientes las preguntas literales ACA-01…ACA-25, la identificación académica de Q21/Q22 y el cálculo de aceptación 20/25 o 36/45.
- Los cinco agentes existen como módulos independientes, pero el versionado homogéneo de sus instrucciones no está completo: cuatro agentes usan prompts LLM separados y el de ingesta es determinista, sin prompt; el estado queda parcial y no se añadió un prompt sin consumidor.
- MySQL de solo lectura continúa sin configurar, DeepSeek real falló con `DEEPSEEK_NETWORK_ERROR`, y la lectura de metadatos Drive quedó bloqueada por `EACCES`. No hay evidencia actual de conteos, reportes leídos, corpus aprobado/indexado, citas de respuesta real, sincronización real, fuga cero E2E ni latencias del banco.
- Los informes de investigación y las políticas son material documental investigado; no reemplazan aprobación humana ni dictamen jurídico. La evaluación integral del portal se mantiene pendiente de las dependencias anteriores.

## Integración real del frontend y consultas ORM — 2026-11-19

### Completado

- Se cambiaron los repositorios de autenticación, perfil/datos propios, consultas administrativas y agregación de reportes para usar modelos Sequelize con atributos y filtros explícitos. Las formas JSON de solicitudes, departamentos, sincronizaciones y documentos conservan los nombres que consume React.
- `backend/src` ya no contiene llamadas ejecutables a `sequelize.query()` ni SQL escrito a mano en los repositorios. Las transacciones, inclusiones y filtros se expresan con los modelos/operadores ORM. Los cálculos del reporte agrupan los registros retornados por Sequelize y deduplican personas ausentes por día.
- Se reemplazaron pruebas de repositorios que inspeccionaban SQL manual por pruebas que inspeccionan filtros/options de Sequelize, campos seleccionados, relaciones, aislamiento y contratos.
- La prueba de navegación del frontend ahora espera la opción de fecha antes de seleccionarla; se ampliaron los límites de tiempo para los recorridos de UI. La suite frontend pasó **14/14**.
- Verificación real con Sequelize contra MySQL: **50 colaboradores, 50 usuarios, 30 solicitudes, 6 departamentos, 0 documentos indexados y 1 reporte persistido**. Un JWT de prueba permitió consultar `GET /api/auth/me` y `GET /api/colaboradores/me`; ambos respondieron HTTP 200.
- `npm run db:mysql:verify` confirmó la conexión de la aplicación. `GET /api/health`, el frontend Vite y Swagger respondieron HTTP 200 durante la comprobación.
- La suite backend pasó **84 pruebas, 0 fallidas y 4 omitidas**. `npm run build` compiló 520 módulos correctamente.

### Errores, límites y verificación pendiente

- Las lecturas administrativas y algunas integraciones que requieren la cuenta de solo lectura no se pudieron completar por falta de `DB_READ_USER` y `DB_READ_PASSWORD`; el endpoint RRHH de departamentos devolvió HTTP 503. Se mantuvo el requisito de permisos mínimos y no se reutilizó la cuenta de escritura como cuenta lectora. Se necesita provisionar una cuenta MySQL con permiso `SELECT` para probar esas pantallas con registros reales.
- MySQL contiene cero documentos indexados; por eso la vista de documentos no tiene registros reales que mostrar.
- El smoke test HTTP y los conteos de modelos fueron reales; Vitest recorre la interfaz con respuestas controladas. No hay una sesión de navegador automatizada conectada al MySQL local.
- No se cargó el proyecto a la carpeta de Drive. El acceso disponible del proyecto tiene alcance de solo lectura y no hay en esta sesión un conector de Drive con permisos de escritura. La carpeta no debe considerarse actualizada.

### Pendiente

- Configurar credenciales para un usuario MySQL independiente con permiso `SELECT` y volver a probar solicitudes, departamentos, documentos, reportes, vacaciones y dashboard administrativo desde el portal.
- Habilitar acceso de escritura a Google Drive para cargar el paquete del proyecto a la carpeta compartida y confirmar el archivo allí.

### Paquete preparado para Drive

- Se generó localmente `tools/nexotico-hr-project.zip` desde los archivos versionados: 232 archivos, 532,927 bytes. Se verificó que no incluye `.env`, `.credentials` ni `node_modules`. El ZIP aún no se ha subido a Drive.

## Cuenta MySQL de solo lectura y validación del portal — 2026-11-19

### Completado

- Se creó la cuenta MySQL dedicada `portal_rrhh_reader` limitada al host local y con permiso `SELECT` sobre `portal_rrhh.*`. La contraseña aleatoria quedó solo en `backend/.env`, archivo ignorado por Git; no se mostró ni se versionó. `SHOW GRANTS` confirmó que no tiene privilegios de escritura.
- Sequelize autenticó con esa cuenta y ejecutó los modelos de colaboradores, departamentos, solicitudes, documentos y el recolector completo de métricas. Resultado observado: 47 colaboradores activos, 6 departamentos, 30 solicitudes, 0 documentos indexados y 15 grupos de métricas.
- La integración de datos personales pasó contra MySQL real y verificó el aislamiento entre dos colaboradores. La integración del analista pasó y comparó indicadores contra consultas SQL independientes de solo lectura.
- La suite backend pasó **85 pruebas, 0 fallidas y 3 omitidas**. La prueba de datos personales, que requiere habilitar su bandera, se ejecutó aparte y pasó **1/1**.
- Tras reiniciar Express para cargar la cuenta nueva, los endpoints RRHH de departamentos, solicitudes, documentos, sincronizaciones, reportes y vacaciones propias respondieron HTTP 200. El endpoint documental devolvió cero registros porque no hay documentos indexados.
- El servidor recuperó y guardó el reporte del día con estado `COMPLETADO`. DeepSeek no tuvo conectividad de red en esa ejecución y el agente guardó el resumen de respaldo SQL.

### Pendientes y límites

- Las pruebas opcionales de persistencia vectorial y embeddings MySQL siguen omitidas porque sus banderas de integración no se habilitaron.
- La sincronización de Google Drive y la disponibilidad externa de DeepSeek requieren que sus servicios respondan; la conectividad real de DeepSeek falló con `DEEPSEEK_NETWORK_ERROR` durante la generación automatizada.
- No se modificó `backend/.env.example` con valores de acceso; conserva campos vacíos para que cada entorno configure sus propias credenciales.
