# Paquete JSON de políticas para RAG

Este directorio contiene una representación JSON por cada una de las diez políticas fuente de `documents/policies/`. Cada JSON conserva el Markdown original en `contentMarkdown`, presenta las secciones y ofrece `plainText` sin marcas Markdown ni HTML para copiar el contenido limpio.

## Formatos previstos para Drive

| Código | Formato previsto |
| --- | --- |
| NT-PC-03 — Incapacidades | PDF |
| NT-PC-06 — Beneficios corporativos | XLSX |
| Las otras ocho políticas | Documento de Google |

`manifest.json` incluye el enlace de destino y la distribución. Los campos `workflow` indican que estos archivos todavía no están en Drive ni aprobados para indexación.

## Copiar texto limpio

Para llevar el texto de una política a Google Docs, copia el valor de `plainText` y pégalo con **Ctrl+Shift+V**. Ese atajo pega texto sin formato; no convierte el JSON en un documento de Google ni sube archivos a Drive.

## Estado y compatibilidad

- Los JSON son un paquete de intercambio y respaldo, no documentos nativos de Google Drive.
- El agente de ingesta actual acepta PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets; **no acepta JSON**. Antes de indexar, hay que crear los formatos indicados arriba y completar el flujo RRHH de revisión/aprobación.
- No se ha ejecutado una subida. El backend solicita el scope `drive.readonly` y no puede crear ni editar archivos. La integración Google Drive de esta sesión tampoco está conectada.
- Los metadatos y textos se copiaron de los Markdown versionados; no se alteró el contenido legal ni se afirma una aprobación nueva.
