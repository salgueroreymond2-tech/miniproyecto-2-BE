# Checklist de requisitos de aceptación

**Fecha de corte:** 18 de noviembre de 2026.
**Estados:** `VERIFICADO` = comprobado en la ejecución/código indicada; `PARCIAL` = hay evidencia limitada o un subrequisito pendiente; `BLOQUEADO` = faltan credenciales, guía o corpus para medirlo; `FALLIDO` = comprobación ejecutada con resultado adverso.

| Requisito | Estado | Evidencia / límite |
|---|---|---|
| Leer guía académica original | **BLOQUEADO** | No aparece en el repositorio ni entre los adjuntos inspeccionados. El informe documental local no contiene el enunciado académico. |
| Extraer las 25 preguntas originales | **BLOQUEADO** | No se inventaron. `evaluation.csv` reserva ACA-01…ACA-25 con campos vacíos y explica el bloqueo. |
| Verificar que las preguntas originales 21 y 22 se rechacen | **BLOQUEADO** | Se aprobaron como pruebas propias las consultas de compañero y salario; sin guía no se verifica correspondencia literal con Q21/Q22. |
| Banco de 20 preguntas propias con respuestas esperadas previas | **PARCIAL** | Las 20 preguntas y respuestas esperadas constan en CSV. Cuatro controles se aprobaron solo a nivel unitario; las preguntas documentales/personales no tuvieron ejecución real por falta de corpus/lectura. |
| Cinco agentes independientes | **VERIFICADO EN CÓDIGO** | Archivos independientes para orquestador, políticas, datos del colaborador, analista e ingesta/sincronización; responsabilidades y contratos delimitados por módulos/esquemas. |
| Instrucciones propias por agente | **PARCIAL** | Orquestador, políticas, datos personales y analista tienen prompts/instrucciones separados. Ingesta es determinista, sin LLM; sus reglas residen en el módulo. No hay prompt autónomo consumido por ese agente. |
| MySQL como único almacenamiento persistente de la aplicación | **VERIFICADO EN CÓDIGO** | Sequelize/mysql2 y consultas MySQL son las conexiones persistentes activas. La búsqueda RAG usa `document_chunks_e5` en MySQL y similitud coseno Node.js; no se hallaron drivers activos PostgreSQL/Supabase/vector DB. Hay referencias históricas en documentación de fases previas. |
| Conexión real a MySQL | **PARCIAL** | `db:mysql:verify` autenticó correctamente con la cuenta de aplicación. No se verificó esquema/conteo de filas usando una cuenta de solo lectura. |
| Mínimo 50 colaboradores ficticios | **BLOQUEADO** | El historial reporta 50 en verificaciones previas; el conteo actual no se ejecutó porque faltan `DB_READ_USER`/`DB_READ_PASSWORD`. No se utilizó la cuenta de escritura para extraer datos. |
| Tres meses de movimientos | **BLOQUEADO** | El historial reporta movimientos de septiembre a noviembre de 2026. No se verificó la cobertura actual por la ausencia de la cuenta de lectura. |
| Al menos 10 documentos de políticas | **PARCIAL** | Existen localmente diez políticas en MD, DOCX y PDF. El corpus documental validado/indexado en MySQL no se pudo comprobar ahora; Drive tenía cero archivos en el listado recursivo del 17 de noviembre y la verificación actual quedó bloqueada. |
| Embeddings locales 384 dimensiones | **VERIFICADO** | Verificación real del modelo y vector normalizado; similitud técnica de ejemplo 0.8778786413679619. No implica precisión documental. |
| Búsqueda, relevancia y umbral RAG calibrados | **BLOQUEADO** | Las pruebas de lógica pasan con fixtures, pero sin corpus ni banco original no se puede calibrar ni medir relevancia real. El umbral configurado es 0.75 y no se declara óptimo. |
| Respuestas legales exactas, separadas de política interna | **PARCIAL** | Se consultaron fuentes oficiales y se corrigieron NT-PC-03 y NT-PC-04 a versión 1.1. Las nuevas versiones deben ser revisadas/atestadas por RRHH antes de indexar; nueve documentos no se revalidaron página por página durante esta corrida. |
| Citas verificables en toda respuesta legal fundamentada | **BLOQUEADO** | Las pruebas validan procedencia literal de citas simuladas. No hay fragmentos reales activos para verificar citas generadas por una consulta real. |
| Consultas sin evidencia y política inexistente | **PARCIAL** | Pruebas unitarias verifican abstención sin evidencia. Falta ejecutar el caso contra el corpus RAG vivo. |
| Consultas mixtas y seguimiento conversacional | **PARCIAL** | Pruebas separadas cubren combinación paralela y aislamiento del contexto; no hay ejecución integrada sobre MySQL, DeepSeek y Drive en esta corrida. |
| Seguridad JWT, roles y SQL injection | **VERIFICADO EN PRUEBAS UNITARIAS** | Suites backend aprobaron casos de tokens, permisos, entradas inválidas, parametrización y límite de intentos; fixtures simulados, sin E2E real. |
| Cero fugas en solicitudes restringidas | **PARCIAL** | Rechazo determinista de vacaciones de tercero y salario aprobado en unit tests; no se afirma cero fugas con base de datos/servicios reales. |
| Separación de herramientas entre agentes | **VERIFICADO EN CÓDIGO/PRUEBAS UNITARIAS** | El agente personal expone lista cerrada de herramientas; herramientas solo consultan perfil propio. Agente RAG consulta fragmentos documentales activos, no expedientes. Falta caja negra con corpus real. |
| Conexión real con DeepSeek y respuesta generada | **FALLIDO/BLOQUEADO POR RED** | La verificación actual devolvió `DEEPSEEK_NETWORK_ERROR`, sin estado HTTP. No es evidencia de clave inválida. En esta corrida no se obtuvo respuesta real. |
| Google Drive, PDF/Google Docs/hojas de cálculo | **PARCIAL** | Extracción local de PDF, DOCX y XLSX y pruebas de formato están en el historial y suite. El listado metadata-only actual terminó con `EACCES`; la carpeta estaba vacía en verificación anterior. No se leyó ni modificó ningún archivo ahora. |
| Cambios nuevos, modificados y eliminados en Drive | **PARCIAL** | Implementación y pruebas unitarias de detección incremental existen; no se validó con cambios reales de Drive. No se ejecutó `changes.list` ni sync en esta auditoría. |
| Historial persistido y reportes diarios | **BLOQUEADO PARA DATOS REALES** | Suite prueba repositorios/rutas y cron con dobles controlados. No se leyó `consultas_chat` ni `reportes_diarios` por falta de cuenta `SELECT`, ni se generó un reporte nuevo. |
| Automatizaciones 06:00 y 07:00, America/Costa_Rica | **PARCIAL** | Configuración y control idempotente aprobados en tests; no se mantuvo servidor activo ni se esperó una ejecución cron real. |
| Dashboard protegido y ocho vistas | **PARCIAL** | Build y pruebas frontend/backend pasaron; roles están probados con fixtures. No se hizo recorrido visual/E2E conectado a datos persistidos. |
| 20/25 respuestas originales correctas | **BLOQUEADO** | No se puede puntuar sin preguntas originales ni respuestas reales. |
| 36/45 respuestas correctas totales | **BLOQUEADO** | Las preguntas originales faltan y 16 preguntas propias no se ejecutaron contra fuentes vivas. No se publica una puntuación. |
| Citas en respuestas de política y 0 fugas E2E | **BLOQUEADO** | Corpus vacío/no verificable en esta corrida; pruebas simuladas no satisfacen la aceptación de extremo a extremo. |
| 90 % de respuestas en menos de 8 s | **BLOQUEADO** | No hay latencias de consultas reales del banco. La latencia del endpoint `/models` y la similitud de embedding no son métricas de respuesta de chat. |
| Build final del frontend | **VERIFICADO** | `npm run build`: 520 módulos, Vite finalizó correctamente en 4.47 s. |

## Decisión de aceptación

**No cumple todavía la aceptación integral del sistema.** El build, las suites unitarias y los controles estructurales son satisfactorios; sin embargo, el puntaje académico, la exactitud/citas RAG, cero fugas E2E, métricas de latencia, reportes reales y lectura segura de MySQL continúan sin evidencia suficiente. Los bloqueos y la evidencia por caso se detallan en [`test-results.md`](test-results.md), [`security-audit.md`](security-audit.md) y [`evaluation.csv`](evaluation.csv).
