# Políticas RAG en Markdown

`policies/` contiene diez archivos Markdown de lectura y vista previa, copiados sin cambios desde `documents/policies/`. Esta última carpeta sigue siendo la fuente canónica. `manifest.json` relaciona cada archivo con el formato que se preparará para Drive: ocho documentos de Google, un PDF y un XLSX.

## Vista previa y copia

- En VS Code, abre cualquier `.md` y presiona **Ctrl+Shift+V** para abrir la vista previa. **Ctrl+K**, luego **V**, la abre al lado del texto.
- En Google Docs, **Ctrl+Shift+V** pega texto sin formato; no convierte el Markdown ni crea el archivo en Drive.

## Estado de Drive e ingesta

- Los Markdown están preparados localmente; no se han subido a Drive, aprobado ni indexado.
- `manifest.json` es solo el índice del paquete; los diez documentos de política son `.md`.
- El agente de ingesta actual acepta PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets; no acepta Markdown directamente. Hay que crear los formatos de Drive del manifiesto y completar la revisión/aprobación de RRHH antes de indexarlos.
- El backend conserva scope `drive.readonly`; la integración no puede crear archivos. Comparte la carpeta con la cuenta de servicio como Lector para que pueda leerlos después de subirlos.
