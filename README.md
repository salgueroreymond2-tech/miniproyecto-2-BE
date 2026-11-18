# NexoTico | Portal de Recursos Humanos con RAG multiagente

Portal interno para **NexoTico Servicios Tecnológicos, S.R.L.**, una empresa costarricense ficticia de servicios de software, integración, analítica y soporte. El sistema reúne consultas de políticas de Recursos Humanos, consultas privadas del colaborador autenticado, administración RRHH y reportes diarios. Usa recuperación documental aumentada (RAG) para fundamentar respuestas de políticas y separa esa ruta de los datos personales.

> Proyecto académico. Las personas, cuentas, salarios, horarios, permisos y beneficios de los datos semilla son ficticios. Las políticas internas son propuestas de la empresa ficticia y no sustituyen asesoría legal ni la verificación de normas vigentes.

## Problema y objetivos

La información de RRHH suele estar repartida entre políticas, calendarios y sistemas. El portal busca facilitar consultas con trazabilidad y controlar el acceso a los datos individuales.

- Responder consultas de políticas desde fragmentos documentales validados, con citas y abstención si falta evidencia.
- Permitir al usuario autenticado consultar únicamente sus propios saldos y registros permitidos.
- Dar a RRHH vistas de consulta y reportes diarios calculados desde MySQL.
- Mantener separación entre autenticación, agentes, ingesta, persistencia y presentación.

## Tecnologías

| Área | Tecnologías implementadas |
|---|---|
| Frontend | React 19, Vite, JavaScript, Tailwind CSS 4, React Router, Axios, Recharts |
| Backend | Node.js 22+, Express 5, CommonJS, Sequelize 6, mysql2 |
| Datos | MySQL 8 / InnoDB / JSON, migraciones y seeders Sequelize |
| IA | DeepSeek API para clasificación y generación estructurada; `Xenova/multilingual-e5-small` local para embeddings E5 de 384 dimensiones |
| Seguridad y contratos | JWT, bcrypt, Zod, Helmet, CORS restringido, express-rate-limit |
| API | Swagger UI en `/api/docs` |
| Integraciones | Google Drive API de solo lectura; `node-cron` con zona `America/Costa_Rica` |
| Pruebas | Node test runner, Supertest y Vitest |

MySQL es el único motor de almacenamiento persistente de la aplicación. Los embeddings E5 se guardan como JSON en `document_chunks_e5`; la similitud coseno se calcula en Node.js sobre lotes leídos desde MySQL. No se usa PostgreSQL, Supabase, pgvector ni otro servicio de embeddings.

## Arquitectura

El navegador usa exclusivamente la API Express. JWT y rol se validan en el backend. El orquestador clasifica la intención; las preguntas de políticas van al agente RAG, las propias al agente de datos, las mixtas a ambos en paralelo y los reportes solo a RRHH. Las solicitudes sobre datos de terceros y salarios individuales se rechazan antes de delegar.

El agente RAG genera un embedding local, recupera hasta cinco fragmentos activos y aprobados de MySQL, aplica umbral de similitud y solicita a DeepSeek una respuesta estructurada. El backend solo publica afirmaciones respaldadas literalmente por los fragmentos citados. La ingesta de Drive es determinista, exige aprobación humana por hash y no usa un LLM. Los reportes se calculan desde MySQL y se guardan por fecha; las rutas históricas leen el snapshot almacenado.

Consulte los diagramas detallados en [`docs/diagrams.md`](docs/diagrams.md), las fórmulas en [`docs/reports.md`](docs/reports.md) y los límites observados en [`docs/test-results.md`](docs/test-results.md).

## Estructura del repositorio

```text
backend/
  src/{config,controllers,database,jobs,middleware,models,prompts,
       repositories,routes,services,utils}/
  migrations/  seeders/  test/  .env.example
frontend/src/{components,context,hooks,layouts,pages,routes,services,utils}/
database/mysql/{schema.sql,roles.sql,reports.sql}
documents/policies/       # diez políticas MD, DOCX y PDF; matriz XLSX
documents/research/        # investigación documental en MD, DOCX y PDF
documents/reports/         # informe técnico en MD, DOCX y PDF
docs/                      # progreso, pruebas, riesgos y arquitectura
tools/build-document-formats.js
```

Los cinco agentes y `vector-store.service.js` viven actualmente en `backend/src/services/`; cuatro prompts de modelo están en `backend/src/prompts/`. El código no contiene los directorios `src/agents/` y `src/rag/` que aparecían en una estructura objetivo inicial. El SQL base y las migraciones de Sequelize están versionados; los datos semilla se generan mediante `backend/seeders/`, no desde un `seed.sql`. Revise [`database/README.md`](database/README.md) antes de modificar el esquema. La documentación de entrega y su matriz se encuentran en `docs/` y `documents/reports/`.

## Requisitos locales

- Node.js 22 o superior (el frontend declara `>=22.12.0`).
- npm compatible con la versión de Node.
- MySQL 8 con acceso de instalación/migración y cuentas dedicadas para la aplicación y `SELECT`.
- Red disponible la primera vez que se descargue el modelo E5 desde Hugging Face.
- Clave de DeepSeek para clasificación/generación en vivo.
- Opcional: Drive API habilitada, carpeta compartida con una cuenta de servicio de solo lectura y archivo JSON de esa cuenta ubicado fuera del repositorio.

## Instalación y configuración de MySQL

Desde la raíz del repositorio, copia la plantilla sin copiar secretos al control de versiones:

```powershell
Copy-Item backend/.env.example backend/.env
```

Completa `backend/.env` localmente. Crea la base con una cuenta administradora de MySQL:

```sql
CREATE DATABASE IF NOT EXISTS portal_rrhh
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configura `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. La aplicación separa un pool de lectura; para las rutas de datos, dashboard y reportes también configura `DB_READ_USER` y `DB_READ_PASSWORD` para una cuenta distinta con privilegio `SELECT`. El servicio falla de forma cerrada si esa cuenta falta; no reutiliza la cuenta de escritura como respaldo.

Ejecuta instalación, verificación y migraciones desde `backend/`:

```powershell
npm install
npm run db:mysql:verify
npm run db:migrate
```

Las migraciones se diseñaron para una base nueva y son no destructivas. MySQL puede confirmar DDL sin transacción; respalda la base antes de aplicarlas en un entorno persistente. Para roles MySQL de ejemplo revise `database/mysql/roles.sql`; el script no crea usuarios ni contraseñas y requiere revisión/aplicación administrativa. Los permisos allí son una base por validar contra los endpoints y operaciones habilitados.

### Datos ficticios de demostración

En una base de desarrollo vacía, el seeder prepara 50 colaboradores sintéticos en seis departamentos y crea cuentas de demostración. Los correos siguen `persona01@nexotico.test` a `persona50@nexotico.test`; las primeras dos cuentas tienen rol `RRHH` y las demás se etiquetan como `COLABORADOR`. Solo los primeros 47 usuarios se crean activos. El seeder requiere que `DEMO_PASSWORD` se configure en el entorno local con una contraseña privada de al menos 12 caracteres; no se publica una contraseña predeterminada.

```powershell
npm run db:seed
```

No ejecutes un seeder de demostración sobre una base con datos que debas conservar. El estado actual de la base de cada desarrollador no se presupone.

## DeepSeek y embeddings locales

En `backend/.env`, completa `DEEPSEEK_API_KEY`, conserva o selecciona un modelo habilitado en tu cuenta mediante `DEEPSEEK_MODEL` y ajusta opcionalmente `DEEPSEEK_TIMEOUT_MS`. La implementación usa `https://api.deepseek.com`, JSON estructurado validado con Zod y registra latencia sin registrar prompt, respuesta o secreto.

Comprueba el modelo de embeddings y la disponibilidad del proveedor con los scripts reales:

```powershell
npm run ai:verify-embeddings
npm run ai:verify-deepseek
```

El embedding activo es `Xenova/multilingual-e5-small`, 384 dimensiones, mean pooling y normalización. Las preguntas llevan prefijo `query:` y los documentos `passage:`. El modelo se carga una vez por proceso y su caché local queda en `backend/.cache/huggingface/`. Una prueba de generación real depende de que haya red/modelo descargado. La evaluación más reciente no pudo verificar DeepSeek en vivo por un error de red; véase [`docs/test-results.md`](docs/test-results.md).

## Google Drive

La integración es opcional hasta que se configura. Habilita Drive API, guarda la clave JSON de la cuenta de servicio fuera del repositorio y comparte la carpeta con dicha cuenta como **Lector**. Completa `GOOGLE_DRIVE_FOLDER_ID` y `GOOGLE_APPLICATION_CREDENTIALS` (ruta local al JSON). El código solicita solo el scope `drive.readonly`.

Con JWT `RRHH`, usa los endpoints documentados en `/api/docs`: revisar candidatos, aprobar manualmente el hash luego de validar normativa y ausencia de datos personales, ejecutar el piloto de un documento aprobado y solo después sincronizar el resto. Se admiten PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets. La detección automática de datos personales es un filtro adicional y no reemplaza revisión humana. Los cambios y eliminaciones se reconcilian; no se borran originales de Drive.

## Variables de entorno

La plantilla autoritativa es [`backend/.env.example`](backend/.env.example). Las variables son:

| Variable | Uso |
|---|---|
| `PORT`, `NODE_ENV`, `TZ`, `CORS_ORIGIN` | Puerto, modo, zona horaria del proceso y origen permitido de Vite |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión MySQL de aplicación/escritura |
| `DB_READ_USER`, `DB_READ_PASSWORD` | Cuenta MySQL separada para consultas de lectura |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma privada y vigencia de tokens |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_TIMEOUT_MS` | Proveedor de IA y tiempo máximo de solicitud |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` | Modelo local E5 y dimensión esperada; cambiarlo requiere migrar/reindexar |
| `RAG_TOP_K`, `RAG_SIMILARITY_THRESHOLD`, `ORCHESTRATOR_CONFIDENCE_THRESHOLD` | Recuperación y confianza de clasificación |
| `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | Carpeta y ruta local a credenciales de Drive |
| `DEMO_PASSWORD` | Contraseña privada requerida únicamente para el seeder de demostración |

No escribas los valores reales en README, capturas, logs ni archivos versionados. `.env`, las credenciales JSON y cachés locales están excluidos por `.gitignore`; `backend/.env.example` contiene solo nombres y valores inocuos.

## Ejecución

Dos terminales, ambas desde las carpetas indicadas:

```powershell
# Terminal 1
Set-Location backend
npm install
npm run dev
```

```powershell
# Terminal 2
Set-Location frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`. API: `http://localhost:3000/api`. Salud: `GET /api/health`. Swagger: `http://localhost:3000/api/docs`. CORS permite el origen `CORS_ORIGIN` configurado.

Para iniciar el servidor sin recarga, en `backend/` usa `npm start`. Para compilar el frontend usa `npm run build` y para servir el build localmente `npm run preview` desde `frontend/`.

## Pruebas

```powershell
# En backend/
npm test

# En frontend/
npm test
npm run build
```

Las integraciones de MySQL y E5 real están detrás de interruptores de prueba opcionales (`MYSQL_INTEGRATION`, `MYSQL_EMPLOYEE_INTEGRATION`, `MYSQL_REAL_EMBEDDINGS`). No los actives en una base de producción. Desde `backend/`:

```powershell
$env:MYSQL_INTEGRATION='1'
node --test test/mysql-vector.integration.test.js
```

Para las otras pruebas, revisa `test/employee-data.mysql.integration.test.js` y `test/mysql-e5-real.integration.test.js`; cada una requiere habilitar únicamente su variable correspondiente. Usa una base de pruebas configurada; las integraciones vectoriales usan una transacción revertida. Resultados ejecutados y sus límites están en `docs/test-results.md`; las pruebas con dobles no prueban la disponibilidad de un proveedor externo ni la exactitud RAG de un corpus real.

## Informes y material de entrega

- [`documents/reports/informe-tecnico-portal-rrhh.md`](documents/reports/informe-tecnico-portal-rrhh.md): arquitectura, datos, agentes, RAG, seguridad, automatizaciones y evaluación real.
- [`documents/research/informe-investigacion-rrhh-costa-rica.md`](documents/research/informe-investigacion-rrhh-costa-rica.md): fuentes oficiales y separación entre obligaciones y reglas ficticias.
- [`docs/diagrams.md`](docs/diagrams.md): siete diagramas Mermaid.
- [`docs/presentation-script.md`](docs/presentation-script.md): guion de defensa de 15 minutos y respaldo de cinco minutos.
- [`docs/defense-questions.md`](docs/defense-questions.md): 25 preguntas técnicas posibles y respuestas.
- [`docs/academic-compliance-matrix.md`](docs/academic-compliance-matrix.md): estado de cada requisito y evidencia disponible.

Los PDF/DOCX se generan desde Markdown con `node tools/build-document-formats.js` en la raíz. El generador también produce la matriz XLSX de políticas. No uses sus artefactos como evidencia de ejecución de la aplicación.

## Limitaciones conocidas

- La guía académica original no está disponible en el repositorio/adjuntos inspeccionados. Los 25 identificadores originales quedan sin pregunta literal; por eso no existe una puntuación de 25 originales ni de 45 total.
- En la auditoría más reciente las pruebas unitarias pasaron, pero no se pudo probar chat integrado con DeepSeek ni Drive (errores de red/`EACCES`). Drive se había listado sin archivos en una revisión anterior.
- Las diez políticas existen localmente, pero no se verificó un corpus aprobado e indexado en MySQL. No se certifican citas RAG en vivo ni calidad/calibración del umbral.
- La cuenta dedicada `DB_READ_USER`/`DB_READ_PASSWORD` no estaba disponible durante la auditoría. La autenticación de escritura a MySQL no prueba lecturas de tablas, conteos actuales ni dashboard con datos.
- Los embeddings JSON y el escaneo de similitud coseno en Node.js son razonables para un corpus académico pequeño, pero implican lectura y cálculo lineal por lotes, consumo de memoria/CPU y menor escalabilidad que un motor con índice vectorial dedicado.
- Los cron dependen de que el proceso Node permanezca activo. Un despliegue distribuido requiere coordinación persistente y observabilidad más robusta; el código actual usa bloqueos del trabajo y claves únicas de ejecución en MySQL.
- La validación humana de documentos, los permisos de base, retención legal, revisión jurídica, pruebas E2E con datos ficticios y una evaluación de desempeño en producción son pendientes antes de uso real.
