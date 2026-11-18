# Resultados de auditoría y pruebas

**Fecha:** 18 de noviembre de 2026
**Alcance:** revisión del código existente, pruebas automatizadas, verificación limitada de conexiones y documentos normativos. No se ejecutó sincronización, ingesta ni generación manual de reportes.

## Resumen ejecutado

| Verificación | Resultado real | Alcance y límite |
|---|---|---|
| `backend`: `npm test` | **Aprobado:** 83 pruebas, 0 fallidas, 4 omitidas (87 casos contabilizados), 27,236 ms | Las omitidas son integraciones condicionadas por configuración/credenciales. Las pruebas de agentes usan fixtures y no miden exactitud real de RAG. |
| `frontend`: `npm test` | **Aprobado al repetir en forma aislada:** 14 pruebas, 0 fallidas | Una ejecución simultánea con backend/build tuvo un timeout en la redirección al panel RRHH; esa prueba aislada y la suite completa aislada pasaron. No se cambió código por un fallo no reproducible. Son pruebas de componentes/rutas, no una sesión E2E contra MySQL. |
| `frontend`: `npm run build` | **Aprobado:** Vite compiló 520 módulos en 3.92 s | Confirma compilación de producción, no conectividad de las páginas administrativas. |
| `backend`: `npm run db:mysql:verify` | **Aprobado parcialmente:** MySQL autenticó con la cuenta de aplicación | Solo se verificó autenticación. No se consultaron tablas con esa cuenta porque falta la cuenta de solo lectura. |
| `backend`: `npm run ai:verify-embeddings` | **Aprobado:** Xenova/multilingual-e5-small, 384 dimensiones, vector normalizado; similitud de prueba 0.8778786413679619 | Pregunta/pasaje técnicos de prueba; no valida recuperación contra el corpus de RRHH. |
| `backend`: `npm run ai:verify-deepseek` | **Bloqueado:** `DEEPSEEK_NETWORK_ERROR`, sin respuesta HTTP, estado `null`; verificación de modelos registró 713 ms | No se concluye que la clave sea inválida. Las pruebas unitarias de DeepSeek usan `fetch` simulado. |
| Google Drive, consulta metadata-only | **Bloqueado:** el proceso Node terminó con `EACCES` | No se descargaron archivos ni se ejecutó sincronización. El registro anterior de `docs/PROGRESS.md` indica que el 17 de noviembre se autenticó con `drive.readonly` y no encontró archivos en la carpeta/subcarpetas. |
| Integraciones de analítica y datos personales contra MySQL | **Omitidas/bloqueadas:** faltan `DB_READ_USER` y `DB_READ_PASSWORD` | No se usaron credenciales con permiso de escritura para leer perfiles, reportes ni conteos. |
| Pruebas vectoriales MySQL y E5 real | **Omitidas** en esta corrida | Requieren banderas de integración. El historial registra ejecuciones previas transaccionales y reversión, no una comprobación del corpus vigente. |

## Resultados RAG y agentes

- Las pruebas automatizadas verifican similitud coseno, umbral configurable (predeterminado `0.75`), límite de cinco fragmentos, rechazo de citas no literales, umbral sin evidencia, validación estructurada y delimitación de prompt injection. Estas pruebas usan fragmentos y respuestas controlados.
- Las diez políticas existen localmente en Markdown, PDF y DOCX. La carpeta Drive consultada el 17 de noviembre no contenía documentos; la consulta de Drive de esta auditoría no pudo completarse. Por ello no existe un corpus activo verificado contra el cual medir relevancia, exactitud, citas, consultas mixtas o seguimiento real.
- No se calibró el umbral RAG: no hay preguntas/respuestas reales vinculadas a fragmentos aprobados. El valor de configuración se conserva y no se afirma que sea óptimo.
- La tabla detallada del banco y sus estados está en [`evaluation.csv`](evaluation.csv). Las 25 preguntas originales no se reconstruyeron porque la guía académica no está en el repositorio ni en los adjuntos inspeccionados. Se reservaron IDs ACA-01…ACA-25 sin inventar texto. Las preguntas de compañero y salario se evaluaron como pruebas propias; no puede confirmarse que sean las preguntas 21 y 22 de la guía.
- No se calculó una puntuación de 20/25 o 36/45 ni el porcentaje de latencia menor a ocho segundos: faltan enunciados originales, corpus activo, conexión DeepSeek de esta corrida y respuestas de extremo a extremo.

## Verificación documental legal

- Se consultó el texto vigente de la [Ley N.° 10673 en SCIJ/PGR](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2020-2029/2025-2029/2025/19752/174EA0.HTML) y la ficha de publicación de la [Asamblea Legislativa](https://www.asamblea.go.cr/sd/Lists/Archivo_Leyes/DispForm.aspx?ContentTypeId=0x010027F4CF5CCAE4F047BABD7F5711AD329C&ID=1953). La reforma de 2025 actualiza el tratamiento legal del teletrabajo en el extranjero. Se incorporó a NT-PC-04 v1.1 y se aclaró que la restricción de NexoTico es una regla interna ficticia.
- El texto oficial del [Reglamento de incapacidades en SCIJ/PGR, artículo 41](https://pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/R/2010-2019/2010-2014/2014/12E60/FABA2.HTML) recoge un plazo de 48 horas para el aviso formal según la disposición aplicable. La disposición de [constancias de médicos de empresa](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/R/2010-2019/2010-2014/2014/12DD3/FA20E.HTML) contiene un trámite de remisión distinto de cinco días hábiles. Se corrigió NT-PC-03 v1.1 para no presentar este último como plazo universal. Deben revisarse las excepciones del caso antes de dar orientación individual.
- La descarga directa del PDF de normativa CCSS respondió 403; se documentó esa limitación en la política. El [texto de Ley 8968 en SCIJ/PGR](https://www.pgrweb.go.cr/DOCS/NORMAS/1/VIGENTE/L/2010-2019/2010-2014/2011/1153F/DCEF7.HTML) y las fuentes oficiales de teletrabajo sí fueron consultados. El sitio de PRODHAB continúa sin verificación directa desde este entorno.
- Los formatos DOCX/PDF de las dos políticas corregidas y la matriz XLSX fueron regenerados con `node tools/build-document-formats.js`: 10 Markdown procesados, 23 formatos generados, informe de investigación de 8 páginas y 11 hojas de XLSX.

## Pruebas de seguridad relacionadas

La suite aprobó pruebas unitarias para tokens ausentes, inválidos y vencidos; roles; límites de intentos; entradas de inyección; filtrado del historial por usuario; autorización de reportes y administración; consultas de terceros; salario individual; prompt injection; citas no sustentadas y filtrado de campos de datos personales. Son pruebas con servicios o repositorios controlados; no acreditan ausencia de fugas en una sesión real conectada a los datos.

Ver el detalle y los límites de cada control en [`security-audit.md`](security-audit.md).

## Fallos, pendientes y bloqueos

1. **Bloqueado por insumos:** guía académica original ausente; no se puede extraer ni calificar las 25 preguntas ni verificar la identidad de las preguntas 21 y 22.
2. **Bloqueado por MySQL:** configurar una cuenta separada con `SELECT` para pruebas de indicadores, registros personales, endpoints administrativos y reportes persistidos.
3. **Bloqueado por corpus:** colocar documentos normativos y políticas revisados en Drive, confirmar que no contienen datos personales, aprobarlos y ejecutar primero el piloto y luego la sincronización.
4. **Bloqueado por red/proveedor:** la verificación DeepSeek devolvió `DEEPSEEK_NETWORK_ERROR` sin respuesta HTTP en esta sesión; repetir cuando el endpoint sea accesible.
5. **Bloqueado por red/proveedor:** la consulta metadata-only de Drive terminó en `EACCES`; reintentar con conectividad disponible. No repetir una sincronización como sustituto.
6. **Pendiente:** ejecutar el banco independiente, validar citas reales y respuestas mixtas/conversacionales, medir al menos 90 % de latencias por debajo de ocho segundos, generar/recuperar reportes y hacer recorrido autenticado del dashboard con cuentas ficticias de ambos roles.

## Reejecución para la entrega documental — 18 de noviembre de 2026

| Comprobación | Resultado observado en esta tarea | Alcance |
|---|---|---|
| `backend`: `npm test` | **83 aprobadas, 0 fallidas, 4 omitidas** (87 casos, 7.82 s) | Se repitieron suites unitarias; cuatro integraciones continúan omitidas por configuración/servicios. |
| `frontend`: `npm test` | **14 aprobadas, 0 fallidas** (24.51 s) | Suites Vitest de frontend; no recorren la app con MySQL vivo. |
| `frontend`: `npm run build` | **Aprobado:** 520 módulos; Vite reportó 1.40 s | Build de producción, no verificación visual ni E2E. |
| `node tools/build-document-formats.js` | **Aprobado:** 10 políticas, 25 artefactos generados, informe de investigación 8 páginas, informe técnico 9 páginas, matriz de políticas 11 hojas | Verifica el generador documental; conteos tomados de su salida, no del render manual en Word. |
| `node --check tools/build-document-formats.js` | **Aprobado** | Sintaxis del generador de formatos. |

Los bloqueos externos y las conclusiones de la auditoría de seguridad permanecen como se documentan arriba: esta reejecución no consultó MySQL, Drive ni DeepSeek en vivo y no convierte los tests unitarios en evaluación integral del sistema.
