# Reportes diarios de Recursos Humanos

Los reportes se calculan una vez por fecha local de `America/Costa_Rica` y se guardan como JSON en `reportes_diarios`. Las rutas de consulta leen esa copia almacenada; no vuelven a calcular indicadores. La fecha tiene restricción única y generar el mismo día devuelve el reporte existente.

## Fórmulas y períodos

- **Colaboradores activos:** conteo de `colaboradores.estado = ACTIVO` al tomar la instantánea.
- **Personas ausentes hoy:** personas activas con una incapacidad vigente (`REGISTRADA` o `EN_REVISION`) o una solicitud aprobada que cubra la fecha. Cada persona se cuenta una sola vez. Si coincide más de una causa, se clasifica primero como `INCAPACIDAD`; entre solicitudes se usa el tipo en orden alfabético. El detalle se agrupa por tipo y departamento.
- **Solicitudes pendientes:** conteo y filas con estado `PENDIENTE` al momento de generar el reporte. “Más de tres días sin respuesta” significa más de tres días calendario completos entre `DATE(creado_en)` y la fecha del reporte (`DATEDIFF > 3`); no son días hábiles.
- **Incapacidades activas:** cantidad de registros no cerrados que cubren la fecha del reporte y pertenecen a colaboradores activos. También se cuenta a las personas distintas.
- **Días de incapacidad del mes:** días calendario desde el primer día del mes hasta la fecha del reporte, inclusive. Se cuenta cada combinación distinta de colaborador y fecha que cae dentro de un registro, para no duplicar días cuando hay traslapes.
- **Ingresos y salidas mensuales:** colaboradores distintos con movimiento `INGRESO` o `SALIDA` cuya fecha efectiva cae entre el primer día del mes y la fecha del reporte, inclusive.
- **Rotación acumulada del año:** `salidas distintas desde el 1 de enero / ((dotación al 1 de enero + dotación a la fecha del reporte) / 2) × 100`. La dotación en una fecha usa `fecha_ingreso <= fecha` y `fecha_salida IS NULL OR fecha_salida > fecha`. Si la dotación promedio es cero, la tasa es 0%. Es una métrica administrativa del proyecto y no una fórmula legal.
- **Vacaciones sobre 20 días:** colaboradores activos cuya suma de `dias_disponibles` entre sus saldos es mayor que 20. Se reporta saldo disponible, no una conclusión legal sobre acumulación.
- **Chatbot del día anterior:** ventana de medianoche a medianoche en `America/Costa_Rica`; la consulta compara sus límites UTC con `creado_en`. Se considera resuelta sin escalamiento cuando `resolucion = RESPONDIDA` y `escalamiento_realizado = false`. Porcentaje: consultas que cumplen esa condición / consultas totales × 100. Sin consultas, el porcentaje es 0%. La latencia es `AVG(latencia_ms)`, que ignora valores nulos; sin valores queda `null`.
- **Cinco temas principales:** hasta cinco valores de `tema`, ordenados por cantidad descendente y luego alfabéticamente. Los temas vacíos se agrupan como `SIN_CLASIFICAR`.
- **Preguntas sin evidencia RAG:** texto de consultas del día anterior marcadas `SIN_EVIDENCIA` y clasificadas `POLITICA` o `MIXTA`.
- **Tendencia de ausencias (30 días):** personas distintas por día calendario con incapacidad registrada/en revisión/cerrada o solicitud aprobada. Una persona se cuenta una vez al día aunque se solapen causas. Se incluyen días con cero personas.
- **Solicitudes por estado:** conteo de cada estado guardado al generar la instantánea.

## Automatización y persistencia

`node-cron` programa la sincronización Drive a las 06:00 y el reporte a las 07:00, en `America/Costa_Rica`. El proceso Node debe permanecer activo para ejecutar los horarios. En cada ejecución se guarda estado, inicio, finalización, resultado resumido o código de error en `trabajos_programados`. La clave única por tarea y fecha, los bloqueos locales y la unicidad de `reportes_diarios.fecha` protegen contra duplicados. Al arrancar después de las 06:00 se recupera una sincronización faltante; después de las 07:00 se genera un reporte solo si todavía no hay uno almacenado para hoy.

El lector de reportes debe configurar `DB_READ_USER` y `DB_READ_PASSWORD` con permisos `SELECT`. Solo la persistencia de reportes y el registro de tareas usan el pool de escritura.

## API administrativa

Todas las rutas requieren JWT y rol `RRHH`:

- `GET /api/reports/latest`: último reporte almacenado.
- `GET /api/reports/history?limit=30`: historial más reciente, con límite de 1 a 365.
- `GET /api/reports/:date`: reporte almacenado para `AAAA-MM-DD`.
- `POST /api/reports/generate`: genera o recupera el reporte de la fecha actual.

La intención estadística del orquestador también está restringida en el backend a RRHH y consulta los indicadores del reporte almacenado. Responde desde ese JSON con valores ya persistidos; si no identifica el indicador, pide que se precise la consulta.
