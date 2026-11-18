# Auditoría de seguridad

**Fecha:** 18 de noviembre de 2026
**Resultado global:** controles de código con cobertura unitaria aprobados; validación real de exposición de datos bloqueada por falta de la cuenta MySQL de solo lectura, corpus documental vacío y conectividad externa inestable.

## Controles revisados

| Riesgo | Control inspeccionado | Evidencia ejecutada | Estado |
|---|---|---|---|
| JWT ausente, alterado o vencido | Middleware verifica firma, vigencia y usuario activo antes de las rutas protegidas. | `test/auth.test.js`: prueba combinada de no autenticación, token inválido, token vencido y usuario desactivado. | **PASS_UNIT** |
| Suplantación de rol o acceso no autorizado | El rol se consulta en backend y las rutas de administración/reportes exigen `RRHH`. | `test/auth.test.js`, `test/report-routes.test.js`, `test/admin-read-routes.test.js` y `test/ingestion-routes.test.js`. | **PASS_UNIT** |
| Acceso a saldo de otra persona | El agente obtiene el usuario del JWT; el repositorio añade filtro obligatorio por el colaborador asociado y campos permitidos. | `test/auth.test.js`, `test/employee-data-agent.test.js`; la prueba de integración MySQL no se ejecutó. | **PASS_UNIT / BLOCKED_DB** |
| Acceso al historial de otra persona | Las consultas de conversaciones filtran por propietario autenticado. | `test/chat-repository.test.js`: aislamiento de historial y conversaciones entre dos usuarios con repositorio en memoria. | **PASS_UNIT / BLOCKED_DB** |
| Salario individual | Regla determinista de orquestación restringe consultas salariales antes de llamar a DeepSeek o a agentes de datos. | `test/orchestrator-agent.test.js`: pregunta sobre gerente general, sin llamadas a clasificador ni agente personal. | **PASS_UNIT** |
| Consultas personales de terceros | Regla determinista restringe vacaciones de un compañero antes de delegar. | `test/orchestrator-agent.test.js`: caso de compañero Juan, sin llamadas a agentes. | **PASS_UNIT** |
| SQL injection | Zod, consultas parametrizadas y selección de columnas/orden permitidos. | `test/auth.test.js` y pruebas de repositorios/rutas administrativas; se rechaza entrada de login `' OR 1=1 --`. | **PASS_UNIT** |
| Prompt injection y SQL arbitrario en texto | Herramientas enumeradas, argumentos Zod, instrucciones no confiables delimitadas; el LLM no ejecuta SQL. | Pruebas `employee-data-agent`, `policies-agent` y `orchestrator-agent`; las pruebas verifican ausencia de llamadas indebidas o citas no sustentadas. | **PASS_UNIT** |
| Exposición de hashes/expedientes | Selección de campos limitada en repositorios personales y autenticación; no se envían expedientes completos al LLM. | `test/auth.test.js` y `test/employee-data-agent.test.js` verifican ausencia de hash/campos sensibles. | **PASS_UNIT** |
| Filtración de credenciales en Git | `.env` y `backend/.credentials/service-account.json` aparecen ignorados por Git; no figuran entre los archivos versionados. | `git check-ignore` y lista de archivos versionados. | **PASS_LOCAL** |
| Dashboard administrativo | Backend comprueba JWT/rol RRHH y frontend restringe las rutas por rol. | Pruebas unitarias de rutas y frontend. No se ejecutó un recorrido E2E contra base de datos. | **PASS_UNIT / BLOCKED_E2E** |
| Permisos de lectura MySQL | `getReadConnection()` requiere credenciales específicas y no hace fallback a la cuenta de escritura. | `test/database.test.js` prueba que el pool de lectura no usa credenciales de escritura. Variables `DB_READ_USER` y `DB_READ_PASSWORD` no están configuradas. | **CONTROL PASS / OPERACIÓN BLOCKED** |
| Acceso del RAG a datos personales o salarios | El store RAG busca únicamente fragmentos documentales activos/aprobados; herramientas personales están aisladas en otro agente. | Pruebas de agente y store; no hay corpus documental real indexado para una prueba de caja negra. | **PASS_UNIT / BLOCKED_E2E** |

## Resultado de las dos consultas restringidas

Las pruebas unitarias del orquestador aprobaron estas entradas:

- `¿Cuántos días de vacaciones tiene mi compañero Juan?` → intención `RESTRINGIDA`; no se llamó al agente personal ni a DeepSeek.
- `¿Cuál es el salario del gerente general?` → intención `RESTRINGIDA`; no se llamó al clasificador ni al agente personal.

Son las pruebas requeridas para esos contenidos, pero la guía académica está ausente y no se puede confirmar que correspondan literalmente a sus preguntas 21 y 22. No se afirma una prueba de extremo a extremo con cuentas y datos MySQL reales.

## Hallazgos y riesgo residual

1. **Alto — operación administrativa sin lectura dedicada:** las rutas que necesitan MySQL de lectura y las integraciones quedan inaccesibles hasta configurar una cuenta con permisos mínimos `SELECT`. No se cambia el código para reutilizar credenciales privilegiadas.
2. **Alto — corpus real no disponible:** al último listado recursivo documentado (17 de noviembre) Drive tenía cero archivos. No se pueden certificar citas, cobertura de legislación, ausencia de documentos con datos personales ni exactitud RAG en producción.
3. **Alto — proveedor y Drive no verificables en esta corrida:** DeepSeek devolvió `DEEPSEEK_NETWORK_ERROR` sin estado HTTP; el listado de metadatos de Drive finalizó con `EACCES`. No se atribuye el fallo a una clave inválida.
4. **Medio — guía académica ausente:** quedan sin validar las preguntas originales y el mapeo de las preguntas 21/22.
5. **Medio — independencia de prompts:** cuatro agentes reciben archivos de instrucciones/prompt independientes. Ingesta ejecuta un pipeline determinista y no llama a un modelo generativo; sus reglas de extracción, aprobación, privacidad y sincronización están en el propio módulo y esquemas. No se agregó un archivo de prompt sin consumidor.
6. **Medio — sesiones reales sin probar:** login, permisos, historial, reportes y dashboard se validaron mediante suites con servicios controlados, no mediante cuentas y base de datos reales durante esta auditoría.

## Dictamen

No se encontró evidencia de una fuga en las pruebas unitarias ejecutadas. Eso **no demuestra cero fugas en ejecución real**. La aceptación de seguridad sigue condicionada a ejecutar pruebas de aislamiento con la cuenta MySQL de lectura, cuentas ficticias de ambos roles y datos reales ficticios, además de revalidar los dos rechazos desde la API.
