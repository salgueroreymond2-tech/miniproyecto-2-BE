# Informe técnico del Portal de Recursos Humanos NexoTico

**Mini Proyecto #2 — Portal de consulta de políticas con RAG multiagente**  
**Empresa ficticia:** NexoTico Servicios Tecnológicos, S.R.L.  
**Versión del informe:** 1.0  
**Fecha de corte:** 18 de noviembre de 2026  
**Responsables:** equipo académico de desarrollo Full Stack  
**Extensión de distribución:** 9 páginas (PDF verificado)

## 1. Introducción y problema

NexoTico es una empresa ficticia costarricense de servicios tecnológicos. El proyecto implementa un portal interno para que una persona colaboradora consulte políticas y algunos datos propios; el personal de Recursos Humanos (RRHH) dispone de administración de consulta y reportes. Se diseñó como entrega académica, no como producto certificado para producción.

El problema abordado es doble. Primero, las respuestas sobre vacaciones, permisos, incapacidades, jornada, pago o privacidad pueden mezclar una obligación legal con una práctica de empresa y quedar sin fuente visible. Segundo, los datos de RRHH son sensibles: una consulta individual debe quedar limitada al usuario autenticado y no exponerse a otros colaboradores o al motor generativo.

La solución combina una API modular, políticas versionadas, autenticación por rol y cinco agentes independientes. El RAG solo responde políticas desde fragmentos aprobados y citas verificables. Los datos personales se consultan con herramientas de backend autorizadas. La analítica se basa en SQL y entrega un snapshot para RRHH. Los datos de demostración son sintéticos; los documentos de políticas son propuestas internas de una organización ficticia.

## 2. Solución y objetivos

El portal resuelve consultas documentales y operativas a través de React, pero todo acceso a persistencia o proveedor pasa por Express. Un JWT validado identifica al usuario. Las rutas personales derivan de ese principal y los repositorios agregan filtros obligatorios por colaborador. La API de administración/reportes exige rol `RRHH` desde el servidor.

Objetivos técnicos: (1) organizar políticas laborales con procedencia; (2) recuperar fragmentos relevantes sin inventar leyes o reglas internas; (3) contestar datos propios con funciones cerradas en vez de SQL libre; (4) agregar métricas desde MySQL y conservarlas históricamente; (5) brindar vistas web responsive que consultan la API; y (6) documentar y medir límites sin presentar pruebas simuladas como integración real.

El alcance excluye la gestión legal de casos, cálculos de planilla, decisiones disciplinarias, almacenamiento de expedientes clínicos y sincronización de documentos sin aprobación humana.

<!-- PAGE BREAK -->

## 3. Arquitectura general y tecnologías

El frontend usa React 19, Vite, JavaScript, Tailwind CSS, React Router, Axios y Recharts. El backend usa Node.js 22+, CommonJS, Express 5, Sequelize y `mysql2`. Zod valida configuración, entradas y contratos de los modelos. JWT y bcrypt gestionan sesión y credenciales; Helmet, CORS restringido y rate limit apoyan la seguridad de HTTP. Swagger publica los contratos REST.

La app Express (`src/app.js`) compone middleware y routers; `src/server.js` configura el proceso, calienta el modelo local y arranca las tareas programadas. La organización separa rutas, controladores, servicios/agentes, repositorios, modelos, prompts, trabajos y utilidades. El frontend tiene rutas y layouts protegidos por rol, páginas, componentes y un cliente Axios centralizado.

Integraciones externas: DeepSeek en `https://api.deepseek.com` para clasificación/generación JSON; el modelo de embeddings E5 corre localmente en CPU con la caché dentro del backend; Google Drive se accede usando la API en solo lectura. MySQL es el único almacenamiento persistente. El navegador no accede directamente a MySQL, Drive ni DeepSeek.

La política CORS admite el origen configurado; las rutas devuelven `Cache-Control: no-store`. La aplicación expone `GET /api/health` y Swagger en `/api/docs`. El árbol de archivos y los flujos de componentes se encuentran en `README.md` y `docs/diagrams.md`.

<!-- PAGE BREAK -->

## 4. Modelo de datos MySQL

El esquema base está en `database/mysql/schema.sql`, evoluciona con migraciones de Sequelize y usa InnoDB, UTF-8, claves foráneas, restricciones e índices. Las tablas de autenticación/organización incluyen `usuarios`, `departamentos`, `puestos` y `colaboradores`. Los registros HR incluyen `saldos_vacaciones`, `solicitudes`, `incapacidades`, `movimientos_personal`, `calendario_pagos` y `evaluaciones_desempeno`.

La memoria conversacional reside en `conversaciones` y `consultas_chat`; estas últimas registran intención, tema, latencia, resolución, fragmentos y documentos citados. `documentos` se vincula con fragmentos activos `document_chunks_e5`; `sincronizaciones`, `ingestion_approvals`, `drive_ingestion_state` y `trabajos_programados` registran operación. `reportes_diarios` conserva un JSON por fecha con una restricción única. `logs_agentes` guarda actividad estructurada sin prompts ni secretos.

Relaciones e identidad se aplican en el backend. Las consultas usan Sequelize con valores parametrizados/replacements. La sesión autenticada es el origen de identidad; nunca se confía en un identificador de colaborador enviado por el usuario o modelo.

La separación de lectura y escritura está preparada en `config/database.js`: `DB_READ_USER` no tiene fallback a la cuenta de aplicación. En la última auditoría faltaban sus credenciales; por esa razón no se ejecutaron consultas de contenido ni comparaciones reales de indicadores. Los permisos de mínimo privilegio se proponen en `database/mysql/roles.sql` y requieren revisión administrativa frente a todas las operaciones habilitadas.

<!-- PAGE BREAK -->

## 5. Diseño multiagente

Los cinco módulos son `orchestrator.agent.js`, `policies.agent.js`, `employee-data.agent.js`, `analyst.agent.js` e `ingestion.agent.js` bajo `backend/src/services/`.

1. **Orquestador:** clasifica políticas, dato propio, consulta mixta, reporte, solicitud restringida o fuera de alcance. Una regla determinista rechaza consultas sobre salario individual y datos personales de terceros antes de delegar. El backend verifica nuevamente el rol para reportes.
2. **Políticas RAG:** genera embedding de la pregunta, busca documentos activos y validados, aplica top-k/umbral, valida la salida y arma citas desde metadatos. Solo publica afirmaciones textuales contenidas en fragmentos recuperados.
3. **Datos del colaborador:** DeepSeek elige una de seis herramientas permitidas; Zod valida selección/argumentos y el backend ejecuta consultas con el usuario del JWT. El modelo no genera SQL. Cifras se construyen desde el resultado MySQL.
4. **Analista:** consultas agregadas desde MySQL generan indicadores y arrays de gráfico. DeepSeek puede escoger frases con IDs permitidos, pero no calcular ni modificar números; si falla la validación se conserva respaldo determinista `SQL_FALLBACK`.
5. **Ingesta:** pipeline determinista de lectura y extracción, evaluación de contenido, autorización humana, embeddings y almacenamiento. No llama al LLM.

La respuesta conversacional conserva `answer`, `agent`, `citations`, `resolved`, `escalationSuggested`, `escalated` y `latencyMs`, además de metadatos internos de auditoría. Intenciones mixtas ejecutan los agentes personal y documental en paralelo y mantienen intactas las citas y cifras.

La memoria persiste en MySQL y cada consulta se filtra por `usuario_id`. El contexto de clasificación utiliza hasta tres pares intención/tema, no el expediente ni el historial completo. Un UUID de idempotencia evita duplicar la misma solicitud.

## 6. Prompts e instrucciones

El prompt del orquestador está separado en `backend/src/prompts/orchestrator.prompt.v1.md`; el agente de datos lee `employee-data.prompt.md`; el analista lee `analyst.prompt.md`; el prompt de políticas está en `policies.prompt.js` y compone la instrucción de evidencia. Los cuatro prompts de modelo delimitan roles, datos confiables, salida estructurada y prohibiciones: el modelo no recibe acceso a SQL ni debe resolver sin evidencia.

Hay una diferencia de gestión documental que se conserva explícita: el prompt del orquestador nombra versión `v1`; el del analista declara `1.0`; los prompts de políticas y datos tienen archivo propio pero no metadato de versión uniforme. El agente de ingesta no consume prompt porque su operación es determinista; sus reglas viven en el código, esquemas y procedimientos de aprobación. Por eso existen cinco agentes y cuatro prompts de LLM, no cinco prompts de LLM. El checklist marca como parcial el requisito de instrucciones versionadas homogéneas.

La salida estructurada se comprueba con Zod después de la inferencia. Un esquema JSON disminuye formatos inválidos pero no prueba que una afirmación sea cierta; la verificación de evidencia, restricciones de herramientas y resultados SQL se ejecuta fuera del modelo.

<!-- PAGE BREAK -->

## 7. Ingesta de Google Drive

El agente admite PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets. Usa scope `drive.readonly`, recorre la carpeta configurada, extrae texto, identifica encabezados y secciones, normaliza contenido, calcula hashes y detecta patrones de datos personales como barrera adicional. Una regex no es una garantía de anonimización.

Antes del embedding, RRHH revisa el documento en Drive y aprueba el hash exacto, su categoría, fuentes oficiales, validación normativa y ausencia de datos personales. Los cambios de contenido alteran el hash y requieren nueva aprobación. Se exige procesar primero un piloto aprobado. Si un documento se elimina de Drive, los fragmentos dejan de estar disponibles para respuesta; no se elimina el original remoto.

La sincronización inicial lista archivos. Las posteriores usan `changes.list`, cursor persistente, descarga de archivos modificados y reconciliación de la carpeta para detectar movimientos/eliminaciones. Los documentos y fragmentos se actualizan dentro de transacciones MySQL; las claves Drive y hashes previenen duplicación. La publicación de fragmentos válidos invalida la caché semántica. La tabla de sincronizaciones registra estado y contadores.

El pipeline admite archivos de hasta 20 MB, limita el número de archivos por operación, valida archivos comprimidos y no ingiere una fuente legal fuera de hosts oficiales permitidos. La prueba real más reciente no alcanzó a ejecutar este flujo: la solicitud metadata-only de Drive terminó en `EACCES`; una lista recursiva previa encontró cero archivos. Los formatos locales pasan pruebas automatizadas, pero eso no verifica archivos reales dentro del Drive configurado.

<!-- PAGE BREAK -->

## 8. Embeddings, chunking y recuperación semántica

Se usa `Xenova/multilingual-e5-small`, con 384 valores por vector. El servicio carga una sola promesa del pipeline por proceso, calienta con un ejemplo y reutiliza el modelo. Para embeddings de consulta aplica `query:`; para documentos usa `passage:`. Se solicita mean pooling y normalización, y el tokenizador confirma el límite de 512 tokens incluyendo prefijo y tokens especiales.

El chunker conserva títulos/secciones y referencias de página. Su objetivo es 350–450 tokens de contenido, solapamiento entre 50 y 80 (objetivo 64); en un fragmento corto se conserva el texto entero y, cuando la longitud hace imposible una partición exacta con todos los rangos, utiliza ventanas seguras sin truncar. Verifica que la entrada final con prefijo permanezca bajo 512.

La tabla activa `document_chunks_e5` guarda el JSON, modelo, hash, contenido, versión, estado, categoría, sección y fuente. No mezcla embeddings de modelos distintos: consulta y almacenamiento exigen el nombre exacto del modelo y dimensión. La similitud coseno se calcula normalizando ambos vectores y sumando los productos coordenada a coordenada. Se escanea MySQL en lotes bajo una transacción de lectura consistente, se mantiene top-k y se aplica threshold configurable.

MySQL se eligió como única base para mantener una instalación académica sencilla y una sola fuente de verdad, sin desplegar servicio vectorial adicional. JSON preserva dimensiones y facilita migraciones; Node.js permite expresar y probar una similitud exacta sin plugin. Ventajas: pocas dependencias operativas, integridad referencial junto al documento, trazabilidad y portabilidad del vector. Límites: no hay índice vectorial; cada búsqueda lee y calcula sobre el corpus activo, con coste lineal, CPU/memoria y crecimiento de latencia. El enfoque es adecuado para un corpus pequeño, no se presume escalable. No se usa pgvector.

<!-- PAGE BREAK -->

## 9. DeepSeek y seguridad / privacidad

El cliente DeepSeek llama `/models` para comprobar disponibilidad y `/chat/completions` para respuesta JSON estructurada. Configura modelo y timeout por entorno, limita tokens/mensajes, maneja error HTTP, timeout, red y respuesta inválida, y registra estado/latencia sin prompt, respuesta ni clave. La versión real del proveedor depende de los modelos disponibles para la cuenta; `DEEPSEEK_MODEL` se configura localmente.

Autenticación compara bcrypt, genera JWT con expiración y busca usuario activo. Middleware valida firma/expiración y rol. El login tiene rate limit; Zod valida cuerpo/query; Sequelize parametriza valores. CORS limita origen; Helmet y no-store endurecen las cabeceras. El frontend conserva la sesión de pestaña en `sessionStorage`; cerrar sesión elimina el token, pero el JWT no se revoca antes de caducar.

Controles de privacidad: agente personal con herramientas allowlist y campos mínimos; filtro obligatorio por dueño del JWT; el LLM no recibe expediente completo; el RAG usa fragmentos públicos/internos validados y no consulta tablas personales; consultas de terceros/salarios se rechazan con regla backend; memoria e historial pertenecen al mismo usuario; reportes y administración requieren RRHH. No se registran secretos ni razonamientos internos.

Pruebas unitarias cubren tokens ausentes/alterados/vencidos, permisos, inyección SQL en entradas, prompt injection, historial aislado, campos sensibles y casos de consultas restringidas. Son pruebas con servicios controlados; no acreditan cero fugas E2E. Se recomienda revisar claves y permisos de entorno, rotar secretos ante exposición y mantener la validación humana del corpus.

## 10. Automatización y reportes

`node-cron` ejecuta Drive a las 06:00 y reporte diario a las 07:00 en `America/Costa_Rica`. El servidor debe estar activo. Hay exclusión local de operaciones simultáneas, ejecución con clave única por tarea y fecha, registro de inicio/fin/estado en `trabajos_programados` y recuperación idempotente al iniciar después de la hora programada.

El analista agrega dotación, ausencias distintas por persona, solicitudes, incapacidades, movimientos, tasa de rotación, vacaciones, uso del chat y tendencia de treinta días. La tasa es una métrica administrativa del proyecto: salidas distintas desde inicio de año divididas por el promedio entre dotación al inicio del año y dotación al día del reporte, por cien; si el denominador es cero, el resultado es cero. Definiciones exactas están en `docs/reports.md`.

DeepSeek solo escoge frases construidas a partir de métricas SQL; el resumen debe tener tres a cinco frases. Si no pasa el contrato, el agente produce texto determinista, etiquetado `SQL_FALLBACK`. El JSON completo se guarda en `reportes_diarios` con unicidad por fecha. Los endpoints `/api/reports/latest`, `/history`, `/:date` y `/generate` exigen RRHH; las vistas administrativas muestran los snapshots y no recalculan cifras en React.

<!-- PAGE BREAK -->

## 11. Resultados de evaluación observados

La verificación final de documentación reejecutó las suites: backend **83 aprobadas, 0 fallidas y 4 omitidas** (7.82 s); frontend **14 aprobadas, 0 fallidas** (24.51 s); build Vite **520 módulos** en **1.40 s**. El modelo E5 se había ejecutado realmente en la auditoría del mismo día: 384 dimensiones, normalización y una similitud de prueba técnica de `0.8778786413679619`. Ese número no representa precisión RAG.

La cuenta de aplicación autenticó contra MySQL, pero faltaba `DB_READ_USER`/`DB_READ_PASSWORD`; no se consultaron datos ni se compararon indicadores de reportes con SQL independiente. DeepSeek real quedó bloqueado por `DEEPSEEK_NETWORK_ERROR` sin estado HTTP; no se concluye que la clave sea inválida. La metadata de Drive fue bloqueada por `EACCES`; no se ejecutó ingesta ni sincronización real.

El archivo `docs/evaluation.csv` tiene 45 registros: los 25 IDs académicos reservados no contienen preguntas porque la guía original falta; las 20 preguntas propias tienen expectativas previas. El balance documentado es 4 `PASS_UNIT`, 1 `PARTIAL_UNIT`, 15 `BLOCKED` entre las propias y 25 `BLOCKED` originales. No hay porcentaje de exactitud 20/25 o 36/45, latencia de respuestas reales, validación de citas sobre fragmentos activos o prueba de mezcla E2E. Las pruebas de consultas sobre tercero y salario pasan unitariamente, pero no puede comprobarse que sean Q21 y Q22 literales de la guía.

<!-- PAGE BREAK -->

## 12. Limitaciones, conclusiones y pendientes

La auditoría confirma estructura modular, cinco agentes separados, base MySQL como persistencia activa, contrato con validación Zod, pruebas unitarias y construcción frontend. No confirma operación completa de todos los servicios: falta lectura segura actual de MySQL, conectividad real con DeepSeek y Drive, documentos aprobados e indexados y preguntas originales.

El diseño mantiene límites explícitos: solo personal autenticado ve su información; políticas citan los fragmentos usados; el agente analista no delega cálculo al LLM; la ingesta requiere aprobación; datos ficticios no se presentan como hechos reales. La aprobación de código no equivale a una evaluación de impacto, prueba de seguridad externa o cumplimiento jurídico integral.

La decisión de guardar embeddings E5 como JSON y medir coseno en Node reduce complejidad de despliegue y conserva todos los datos en MySQL, una ventaja concreta para un ejercicio pequeño. Su coste lineal limita el corpus, la concurrencia y el tiempo de respuesta; antes de ampliar volumen se deben medir tamaño, latencia y memoria y valorar alternativas sin romper el requisito de una sola base si sigue vigente.

### Pendientes para completar la defensa con evidencia

1. Incorporar la guía académica y sustituir ACA-01…ACA-25 por las preguntas literales.
2. Configurar una cuenta MySQL separada `SELECT`; comprobar cantidad de colaboradores, movimientos y reportes actuales.
3. Conectarse a DeepSeek y Drive con red disponible, sin divulgar secretos; cargar documentos revisados, pilotear e indexar.
4. Ejecutar el banco de evaluación contra corpus y base reales ficticios; validar citas, respuestas, mezcla, historial y latencias.
5. Repetir la auditoría de seguridad E2E con cuentas ficticias de ambos roles y revisión humana de las políticas.

El dictamen integral queda **pendiente** hasta que esos pasos tengan resultados observados. Las evidencias detalladas y la matriz requisito/archivo se enlazan en `docs/academic-compliance-matrix.md`, `docs/test-results.md`, `docs/security-audit.md` y `docs/requirements-checklist.md`.
