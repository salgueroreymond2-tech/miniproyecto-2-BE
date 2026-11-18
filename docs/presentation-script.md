# Guiones para la exposición

## Guion de presentación de 15 minutos

**Regla de demostración:** use cuentas, datos y documentos ficticios del entorno preparado. La auditoría del 18/11/2026 no verificó chat real con DeepSeek, corpus indexado ni lectura del dashboard por falta de conectividad/cuenta `SELECT`. No afirme que una consulta “en vivo” respondió si esa sesión no se ejecuta. Si persiste un bloqueo, muestre la evidencia documentada y explique el límite; no sustituya la respuesta por datos escritos a mano.

| Tiempo | Presentación y acciones |
|---|---|
| 0:00–1:00 | **Apertura.** “Presentamos NexoTico, una empresa ficticia costarricense de tecnología. El mini proyecto ofrece un portal de consulta de RRHH con citas documentales, acceso personal protegido y un panel administrativo. Todos los colaboradores y registros de demostración son ficticios.” |
| 1:00–2:00 | **Problema.** Explique dispersión de políticas y riesgo de mezclar derecho laboral con reglas internas. Añada el segundo riesgo: que una pregunta personal revele información de otro colaborador. |
| 2:00–3:00 | **Objetivos y alcance.** Mostrar login por rol, portal de colaborador, asistente y vistas de RRHH. Aclare que el portal orienta y no sustituye asesoría legal, decisiones de RRHH ni un cálculo de nómina. |
| 3:00–4:00 | **Identidad y diseño.** Inicie la app solo si backend y servicios están disponibles. Presente la identidad NexoTico, menú responsive y acceso de demostración configurado localmente. No exponga la contraseña ni `backend/.env`. |
| 4:00–5:00 | **Consulta documental.** Pregunte: “¿Qué regla general documentada aplica a las vacaciones y qué fuente la respalda?”. Revise si la respuesta trae versión, sección y enlace. Explique que la política interna se identifica como ficticia y que la respuesta legal debe citar material aprobado. Si el RAG no está en línea, enseñe `policies.agent.js` y sus pruebas, e indique que la respuesta real no fue verificada en la auditoría. |
| 5:00–6:00 | **Consulta sin evidencia.** Pregunte por un beneficio que no aparezca en el corpus o una política inexistente. El comportamiento esperado es abstenerse y recomendar contactar a RRHH; no sugiera una respuesta por cuenta propia. Si no hay corpus real, explique que solo las pruebas unitarias verificaron esta regla. |
| 6:00–7:00 | **Consulta personal.** Con sesión `COLABORADOR`, consulte “¿Cuántos días de vacaciones aparecen en mi saldo?” o “¿Cuál es mi próximo pago programado?”. Señale que la identidad sale del JWT y las filas están filtradas por la cuenta. No lea en público registros personales reales. Si `DB_READ_USER` no está configurado, enseñe el código/prueba y diga que el resultado operativo está bloqueado. |
| 7:00–8:00 | **Consulta mixta.** Pregunte: “¿Qué saldo propio de vacaciones tengo y qué procedimiento documentado debo seguir para solicitarlas?”. La respuesta debe combinar datos propios y evidencia de política, sin alterar cifra ni cita. Si falta cualquiera de MySQL/DeepSeek/corpus, muestre el flujo implementado y reporte que la ejecución E2E está pendiente. |
| 8:00–9:00 | **Pregunta restringida.** Intente “¿Cuántos días de vacaciones tiene mi compañero Juan?” y “¿Cuál es el salario del gerente general?”. El sistema debe rechazar sin llamar al agente personal; estas reglas sí cuentan con pruebas unitarias, pero no se afirmará correspondencia con Q21/Q22 de la guía no disponible. |
| 9:00–10:00 | **Conservación de conversaciones.** Abra historial y explique aislamiento por propietario. Evite mostrar o abrir una conversación de otra cuenta. Si no hay datos persistidos visibles, describa el contrato y las pruebas unitarias, no una conversación simulada. |
| 10:00–11:00 | **Dashboard de RRHH.** Inicie una sesión RRHH y muestre KPIs, series, temas, pendientes e historial solo si los snapshots reales están en MySQL. Destaque fecha/origen del reporte y que React presenta el JSON persistido sin recalcularlo. Si falta la lectura dedicada, indique el bloqueo. |
| 11:00–12:00 | **Documentos e ingesta.** Muestre el endpoint/lista de candidatos si hay acceso real. Exponga la aprobación humana por hash, revisión de fuentes y PII, piloto de un archivo, extracción/chunking, E5 local y sincronización incremental. No ejecute sync si Drive no está disponible. |
| 12:00–13:00 | **Arquitectura.** Use `docs/diagrams.md`: React → Express → MySQL, DeepSeek y E5 local. Explique los cinco agentes; ingesta es determinista y los otros cuatro usan prompts/instrucciones de modelo. MySQL es la única base persistente. |
| 13:00–14:00 | **Evaluación real.** Informe 83 backend aprobadas, 4 omitidas; 14 frontend aprobadas; build 520 módulos/3.92s. El E5 local generó vector 384d. DeepSeek tuvo error de red y Drive `EACCES`; MySQL read no estaba configurado. El banco tiene 45 filas, pero las 25 originales están bloqueadas por falta de guía. No presente puntaje de exactitud global. |
| 14:00–15:00 | **Cierre.** Resuma garantías estructurales y pendientes. Prioridad inmediata: conseguir guía académica, habilitar MySQL de solo lectura, reconectar DeepSeek/Drive, aprobar corpus y ejecutar banco E2E. Concluya que la evaluación integral todavía no puede declararse satisfecha. |

### Lista previa a la exposición

- Iniciar backend y frontend desde sus carpetas y comprobar `/api/health`.
- Confirmar credenciales de demo en privado; usar solo cuentas ficticias y no proyectar secretos.
- Preparar un documento Drive aprobado e indexado si se va a demostrar RAG; verificar vínculo de cita antes de la sesión.
- Confirmar la cuenta de lectura y que el reporte consultado existe en MySQL.
- Tener abiertos `docs/test-results.md`, `docs/security-audit.md` y `docs/evaluation.csv` para respaldar los límites.
- Si una dependencia externa falla, describir el error observado y seguir con el diagrama/código; no simular resultados.

## Guion para video de respaldo de cinco minutos

| Tiempo | Narración / acción |
|---|---|
| 0:00–0:35 | Identidad NexoTico y problema: localizar políticas confiables y consultar información propia sin divulgar expedientes. Aclare que es empresa y población ficticias. |
| 0:35–1:10 | Muestre login y navegación de colaborador. Explique JWT, bcrypt y rutas por rol. No muestre contraseña. Si no hay entorno vivo, muestre archivos y contratos, indicando que la auditoría no verificó E2E. |
| 1:10–2:05 | Asistente: consulta documental y cita con documento, sección, versión y enlace; luego una pregunta sin evidencia que se abstiene. Si el corpus no está cargado, explique el flujo de `policies.agent.js` y el estado pendiente. |
| 2:05–2:45 | Pregunta personal propia, consulta mixta y petición restringida de datos de un compañero. Explique los límites por JWT y el rechazo determinista. No afirme que una respuesta de datos se obtuvo si falta MySQL read. |
| 2:45–3:25 | Panel RRHH, snapshot, fecha, resúmenes, gráficas e historial. Explique el control RRHH y el origen persistido en MySQL. Si no hay snapshot consultable, lea la limitación de evaluación. |
| 3:25–4:15 | Presente arquitectura multiagente e ingesta Drive. Mencione aprobación por hash, revisión normativa/PII, piloto, cambios incrementales y embeddings locales 384d en JSON MySQL con coseno Node.js. |
| 4:15–5:00 | Resultados: suites, build, E5 ejecutado; bloqueos DeepSeek, Drive, cuenta `SELECT` y guía ausente. Cierre con pendientes y no publique una exactitud no medida. |

**Captura recomendada:** grabar desde el navegador solo después de validar cada dependencia real. Si se graba una explicación de código por indisponibilidad, titular esa sección “flujo implementado, integración pendiente”, no “demo funcional”.
