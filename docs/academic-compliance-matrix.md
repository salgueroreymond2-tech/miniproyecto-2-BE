# Matriz de cumplimiento académico y evidencia de entrega

**Corte:** 18 de noviembre de 2026. **Estados:** `VERIFICADO` significa evidencia en código, archivo o ejecución identificable; `PARCIAL` significa que hay una parte implementada, pero falta una verificación o subrequisito; `BLOQUEADO` indica dependencia que impide medir aceptación; `FALLIDO` indica una comprobación ejecutada con resultado adverso. La guía académica original no está disponible en el repositorio ni en los adjuntos inspeccionados, por lo que no se certifica coincidencia literal con ese documento.

| Requisito | Estado | Archivos / evidencia | Alcance o pendiente |
|---|---|---|---|
| Nombre, problema, objetivos y tecnologías | VERIFICADO | [`README.md`](../README.md), [`informe técnico`](../documents/reports/informe-tecnico-portal-rrhh.md) | NexoTico es ficticio; demo solo con datos sintéticos. |
| Instalación, MySQL, migraciones, seed, DeepSeek, E5, Drive y comandos | VERIFICADO | [`README.md`](../README.md), `backend/package.json`, `frontend/package.json`, `backend/.env.example` | Credenciales locales requeridas para integraciones en vivo; no incluidas. |
| MySQL único, Sequelize/mysql2 | VERIFICADO EN CÓDIGO | `backend/src/config/database.js`, `backend/src/models/`, `database/mysql/`, informe técnico | No se confirmó lectura real de tablas por faltar cuenta dedicada. |
| Schema y modelo de datos | VERIFICADO EN CÓDIGO | `database/mysql/schema.sql`, `backend/migrations/`, [`ER y diagramas`](diagrams.md) | Conteos actuales de filas no verificados en esta auditoría. |
| Al menos 50 colaboradores ficticios | PARCIAL | `backend/seeders/`, `database/mysql/seed.sql`, `docs/requirements-checklist.md` | Seeder define 50; el conteo actual requiere `DB_READ_USER`. |
| Tres meses de movimientos ficticios | PARCIAL | `backend/seeders/`, progreso de fase de base de datos, checklist | Hay evidencia histórica, pero no se comprobó contenido actual desde cuenta read. |
| Cinco agentes independientes | VERIFICADO EN CÓDIGO | `backend/src/services/{orchestrator,policies,employee-data,analyst,ingestion}.agent.js` | Ingesta es determinista; no usa LLM. |
| Cinco agentes con instrucciones/prompt versionado homogéneo | PARCIAL | `backend/src/prompts/`; [`informe técnico`](../documents/reports/informe-tecnico-portal-rrhh.md) | Hay cuatro prompts de modelo separados. Versionado explícito es desigual; el quinto agente no consume prompt generativo. |
| RAG E5 local 384d y coseno | PARCIAL | `embedding.service.js`, `vector-store.service.js`, `policies.agent.js`, `docs/test-results.md` | E5 real verificado. No se validó búsqueda/calidad contra corpus HR indexado. |
| Chunking 350–450, overlap, límite 512 | VERIFICADO EN CÓDIGO | `backend/src/services/ingestion.agent.js`, test de ingesta | Casos cortos o particiones imposibles tienen excepción documentada sin truncar. |
| Diez dominios documentales HR | VERIFICADO LOCALMENTE | `documents/policies/01...10*.md/.docx/.pdf`, `documents/policies/matriz-conocimiento-politicas.xlsx` | Existencia local verificada; aprobación e indexación MySQL no verificadas. |
| Informe de investigación independiente 6–10 páginas | VERIFICADO | [`informe de investigación`](../documents/research/informe-investigacion-rrhh-costa-rica.md) y PDF de 8 páginas | Incluye 10 dominios y fuentes oficiales; PRODHAB y PDF directos de CCSS registran accesos bloqueados. No es dictamen jurídico. |
| Informe técnico de 8–12 páginas | VERIFICADO | [`informe técnico`](../documents/reports/informe-tecnico-portal-rrhh.md) y PDF generado | PDF de 9 páginas comprobado mediante el generador del proyecto. |
| Fuentes legales verificables y corte de consulta | PARCIAL | Informe investigación, políticas 03/04 v1.1 | Normas citadas consultadas en sitios oficiales el 18/11/2026; falta revisión individual de todas las fuentes/políticas y acceso PRODHAB. |
| Diferencia entre ley y políticas internas | VERIFICADO EN DOCUMENTOS | Informe investigación y diez políticas | Revisión/certificación por RRHH/asesoría no completada. |
| Arquitectura, ER, login, multiagente, RAG, Drive y reportes en Mermaid | VERIFICADO | [`docs/diagrams.md`](diagrams.md) | Siete diagramas; autenticación y relaciones se describen como código, no como arquitectura idealizada. |
| Guion de exposición 15 minutos y video 5 minutos | VERIFICADO | [`docs/presentation-script.md`](presentation-script.md) | El guion diferencia demostración viva de evidencia unitaria y servicio bloqueado. |
| 25 preguntas de defensa con respuestas técnicas | VERIFICADO | [`docs/defense-questions.md`](defense-questions.md) | Respuestas incluyen límites verificados. |
| Banco de 45 preguntas, expectativas previas | PARCIAL / BLOQUEADO | [`docs/evaluation.csv`](evaluation.csv) | 20 preguntas propias con expectativas. Los 25 IDs originales carecen de enunciado porque no se localizó la guía. |
| Al menos 20/25 originales y 36/45 totales | BLOQUEADO | `docs/evaluation.csv`, [`test-results.md`](test-results.md) | No hay puntaje real; no debe reportarse cumplimiento. |
| Seguridad y privacidad | PARCIAL | [`security-audit.md`](security-audit.md), suites `backend/test/` | Pruebas unitarias aprobadas; fuga cero E2E no demostrada. |
| Login, JWT, roles y rutas de datos propios | PARCIAL | `backend/src/middleware/`, `backend/src/routes/`, tests | Pruebas con dobles pasan; sesión integrada con MySQL no se recorrió. |
| Aislamiento contra terceros / salario | PARCIAL | `orchestrator.agent.js`, `test/orchestrator-agent.test.js` | Rechazo unitario aprobado; Q21/Q22 original y E2E no verificables. |
| DeepSeek real y respuestas de chat | BLOQUEADO | `docs/test-results.md` | `DEEPSEEK_NETWORK_ERROR`, sin estado HTTP; no se atribuye a clave incorrecta. |
| Drive real e ingesta/sync | BLOQUEADO | `docs/test-results.md`, `ingestion.agent.js` | Consulta actual terminó `EACCES`; lista anterior informó carpeta vacía. Sin ingesta real. |
| MySQL de solo lectura y reportes actuales | BLOQUEADO | `database.js`, `test-results.md` | `DB_READ_USER` y `DB_READ_PASSWORD` faltaban; no se consultaron datos ni reportes reales. |
| Cron diario y recuperación | PARCIAL | `backend/src/jobs/scheduler.js`, `docs/reports.md`, tests | Configuración/tests unitarios verificados; tarea real no se observó con proceso activo. |
| Frontend build y suites | VERIFICADO | [`docs/test-results.md`](test-results.md) | 14 tests, build 520 módulos/3.92 s; no prueba navegación E2E con datos reales. |
| `.env.example` cubre variables usadas | VERIFICADO POR BÚSQUEDA | `backend/.env.example`, `backend/src/**` | Incluye variable de confianza del orquestador; plantilla no contiene valores secretos. |
| Credenciales protegidas | VERIFICADO LOCALMENTE | `.gitignore`, `git check-ignore`, `docs/security-audit.md` | No inspeccionar ni publicar valores del `.env`; archivo y JSON de servicio excluidos. |

## Estado de aceptación

La **entrega documental preparada** y las comprobaciones unitarias/build tienen evidencia verificable. La **aceptación integral académica sigue bloqueada** por la guía original, MySQL de solo lectura, corpus aprobado e indexado y conectividad real de DeepSeek/Drive. No hay base para declarar 20/25, 36/45, cero fugas E2E, citas reales o latencia menor a ocho segundos en 90% de consultas.

La fuente más reciente para detalle de ejecución es [`docs/test-results.md`](test-results.md); el registro por pregunta permanece en [`docs/evaluation.csv`](evaluation.csv), y el registro cronológico de trabajo en [`docs/PROGRESS.md`](PROGRESS.md).
