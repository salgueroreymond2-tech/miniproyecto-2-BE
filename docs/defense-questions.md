# 25 preguntas posibles para la defensa

Las respuestas describen el código y la evidencia disponible al 18/11/2026. Cuando una capacidad no se comprobó con servicios/datos reales, se indica esa limitación.

## Conceptos y arquitectura

### 1. ¿Qué es RAG?

RAG significa *Retrieval-Augmented Generation*: antes de generar respuesta, el sistema recupera fragmentos de una fuente controlada y los incluye como evidencia. En este proyecto el agente busca políticas aprobadas en MySQL y DeepSeek redacta una respuesta estructurada basada en esos fragmentos.

### 2. ¿Qué es un embedding?

Es una representación numérica de un texto en un vector que intenta conservar relaciones semánticas. NexoTico usa `Xenova/multilingual-e5-small` localmente y produce 384 componentes normalizados. No es una respuesta ni una prueba de veracidad.

### 3. ¿Cómo funciona la similitud coseno?

Compara el ángulo entre dos vectores: producto punto dividido por el producto de sus magnitudes. El servicio normaliza los dos vectores, suma productos por dimensión y acota el resultado al intervalo [-1, 1]. Un valor alto indica mayor alineación semántica según el modelo, no que los textos sean necesariamente correctos.

### 4. ¿Por qué se eligió MySQL como base única?

Para mantener una sola tecnología de persistencia en la aplicación académica y evitar administrar un servicio vectorial adicional. Sequelize/mysql2 guardan datos relacionales y vectores JSON en la misma fuente. El costo es una búsqueda coseno lineal en Node.js, sin índice vectorial; es razonable para poco volumen, no una afirmación de escalabilidad.

### 5. ¿Qué guarda el proyecto en JSON?

El vector E5 de 384 dimensiones y metadatos de documentos/consultas/reportes. El esquema almacena el nombre del modelo y el flujo filtra el modelo esperado, evitando comparar directamente vectores de modelos distintos.

### 6. ¿Qué función cumple DeepSeek?

Clasifica intención, selecciona herramientas personales permitidas, ayuda a redactar respuestas de políticas con evidencia y selecciona frases estadísticas precalculadas. No consulta MySQL directamente, no ejecuta SQL y no genera embeddings del corpus.

### 7. ¿Qué hace el orquestador?

Aplica primero reglas deterministas para solicitudes sensibles, luego solicita a DeepSeek una intención estructurada validada con Zod y enruta a políticas, datos propios, ambos agentes, reportes o una aclaración. Verifica el rol RRHH en backend antes de la ruta de reportes.

### 8. ¿Cómo se resuelven las consultas mixtas?

El agente de políticas y el de datos del colaborador se ejecutan en paralelo. La respuesta se combina conservando la cita del RAG y los valores construidos desde la consulta personal de MySQL.

### 9. ¿Cómo se evita inventar información?

El RAG necesita fragmentos por encima del umbral configurado, pide salida acotada, valida IDs citados y exige que el texto de cada afirmación exista literalmente en el contenido del fragmento. Si no hay evidencia suficiente, se abstiene y recomienda RRHH. El umbral 0.75 no quedó calibrado en corpus real.

### 10. ¿Cómo se construye una cita?

No la inventa el modelo: el backend la construye con título, sección, versión, número de página cuando está disponible y enlace Google Drive desde metadatos MySQL del fragmento citado.

## Datos, seguridad e ingesta

### 11. ¿Cómo se protegen los datos personales?

El ID propio sale del JWT validado, los repositorios añaden filtro obligatorio por colaborador y el LLM no recibe un expediente completo. Las tablas personales no están disponibles para el RAG. Historiales se consultan por propietario y dashboard/reportes requieren RRHH.

### 12. ¿Puede DeepSeek crear SQL o cambiar un ID de colaborador?

No. El agente personal elige una de seis herramientas allowlist; Zod valida argumentos; el backend ejecuta la operación permitida usando la identidad autenticada. El esquema de herramienta no incluye ID arbitrario de colaborador.

### 13. ¿Qué ocurre ante una petición de vacaciones de un compañero o un salario individual?

El orquestador reconoce estos patrones antes de llamar al clasificador/proveedor y devuelve rechazo determinista. Las pruebas unitarias verifican que no se invoque al agente personal; no se afirma prueba E2E conectada a cuentas reales.

### 14. ¿Qué controles reducen inyección SQL?

Zod limita formas/longitudes, Sequelize parametriza valores y los filtros/órdenes dinámicos parten de allowlists. El texto de una consulta nunca se concatena como sentencia SQL. Aún se recomienda probar toda nueva ruta con pruebas de integración.

### 15. ¿Cómo se procesa un documento Drive?

El servicio usa scope `drive.readonly`, admite seis formatos, extrae texto/secciones, calcula hash, filtra indicios de PII y requiere revisión humana de contenido y norma. RRHH aprueba hash exacto, un documento se prueba primero como piloto, luego se crean chunks, embeddings y persistencia transaccional MySQL.

### 16. ¿Qué representa el chunking usado?

Objetivo 350–450 tokens de contenido, con 50–80 tokens de solapamiento (objetivo 64), encabezado/sección y página. El tokenizer local valida que prefijo `passage:` y tokens especiales no superen 512. Contenido corto se mantiene completo, y no se trunca por alcanzar el objetivo.

### 17. ¿Por qué 384 dimensiones y prefijos `query:`/`passage:`?

Son la dimensión y convención del modelo E5 multilingüe seleccionado. Las dos tareas semánticas reciben sus prefijos respectivos. Cambiar modelo o dimensión exige migrar/reindexar; los settings actuales rechazan una incompatibilidad.

### 18. ¿Cómo evita el sistema duplicar documentos o dejar chunks inconsistentes?

Usa ID Drive y hash del contenido para identificar documentos/actualizaciones, registra cambios y elimina lógicamente el contenido al detectar borrado. Las actualizaciones de documento y fragmentos se hacen en transacciones de MySQL; la versión activa se cambia bajo bloqueo y la caché se invalida después de confirmar.

## Reportes y evaluación

### 19. ¿Cómo se calculan los reportes automáticos?

Consultas SQL agregadas por el repositorio obtienen cifras; los resultados se validan con Zod. DeepSeek solo puede seleccionar frases preconstruidas por IDs; no calcula números. Si la salida no coincide, el agente produce resumen SQL determinista.

### 20. ¿Cómo funciona la tasa de rotación del proyecto?

Salidas distintas acumuladas desde enero divididas entre el promedio de dotación al inicio del año y al día del reporte, multiplicado por 100. Si la dotación promedio es cero, se informa 0. Es una definición administrativa documentada en `docs/reports.md`, no una fórmula legal.

### 21. ¿Por qué node-cron necesita que el servidor permanezca activo?

Las tareas están programadas dentro del proceso Node; si el proceso no está activo en el horario, no puede dispararlas. Hay recuperación de tareas faltantes al arranque, unicidad por fecha y registro en MySQL, pero un despliegue con varias instancias requiere coordinación adicional.

### 22. ¿Qué pasa si DeepSeek está caído al generar el reporte?

La ruta estadística puede usar el resumen determinista generado desde indicadores SQL y marcar origen `SQL_FALLBACK`. Para el RAG, si no puede producir una respuesta validada, el usuario recibe abstención; los valores personales no se fabrican.

### 23. ¿Qué resultados de pruebas pueden defenderse?

En el corte 18/11/2026: 83 pruebas backend aprobadas, 4 omitidas, 0 fallidas; 14 frontend aprobadas; build Vite de 520 módulos en 3.92 s. E5 produjo vector real de 384 dimensiones. Estos resultados unitarios/build no equivalen a exactitud RAG ni integración E2E.

### 24. ¿Se cumplió el mínimo de preguntas correctas del banco académico?

No puede calcularse. La guía académica original no se encontró; los IDs ACA-01 a ACA-25 quedaron sin enunciado inventado. El CSV tiene 20 preguntas propias y resultados parciales unitarios, pero no 45 respuestas reales para calificar.

### 25. ¿Cuáles son los principales pendientes antes de uso real?

Obtener la guía original, habilitar una cuenta MySQL de solo lectura, reconectar DeepSeek y Drive, revisar/aprobar documentos, ejecutar el piloto e ingesta y realizar evaluación E2E con datos ficticios. También se requiere revisión legal/privacidad y calibración del threshold con un conjunto de preguntas etiquetadas.
