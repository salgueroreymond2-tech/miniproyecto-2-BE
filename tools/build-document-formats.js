'use strict';

/*
 * Genera formatos de distribución a partir del corpus Markdown. Se implementa
 * sin dependencias externas para que los documentos sean reproducibles en el
 * entorno base del proyecto y puedan importarse en Google Docs/Sheets.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.resolve(__dirname, '..');
const policiesDir = path.join(rootDir, 'documents', 'policies');
const researchDir = path.join(rootDir, 'documents', 'research');
const fixedDate = new Date('2026-11-17T12:00:00Z');

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getUTCFullYear(), 1980);
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2)
  };
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  const timestamp = dosDateTime(fixedDate);

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'));
    const source = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressed = zlib.deflateRawSync(source);
    const checksum = crc32(source);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    local.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(source.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuffer, end]);
}

function markdownLines(markdown) {
  return markdown.replace(/\r/g, '').split('\n').map((line) => line.trimEnd());
}

function docxParagraph(text, style, indent) {
  const properties = [];
  if (style) properties.push(`<w:pStyle w:val="${style}"/>`);
  if (indent) properties.push('<w:ind w:left="720" w:hanging="360"/>');
  const prefix = indent ? '• ' : '';
  return `<w:p>${properties.length ? `<w:pPr>${properties.join('')}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${xml(prefix + text)}</w:t></w:r></w:p>`;
}

function markdownToDocxBody(markdown) {
  const paragraphs = [];
  for (const rawLine of markdownLines(markdown)) {
    if (rawLine === '<!-- PAGE BREAK -->') {
      paragraphs.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    } else if (!rawLine) {
      paragraphs.push('<w:p/>');
    } else if (rawLine.startsWith('# ')) {
      paragraphs.push(docxParagraph(rawLine.slice(2), 'Title'));
    } else if (rawLine.startsWith('## ')) {
      paragraphs.push(docxParagraph(rawLine.slice(3), 'Heading1'));
    } else if (rawLine.startsWith('### ')) {
      paragraphs.push(docxParagraph(rawLine.slice(4), 'Heading2'));
    } else if (/^[-*] /.test(rawLine)) {
      paragraphs.push(docxParagraph(rawLine.slice(2), null, true));
    } else if (/^\d+\. /.test(rawLine)) {
      paragraphs.push(docxParagraph(rawLine.replace(/^\d+\. /, ''), null, true));
    } else if (/^\|/.test(rawLine)) {
      paragraphs.push(docxParagraph(rawLine.replace(/\|/g, ' · ').replace(/^ · | · $/g, ''), null));
    } else {
      paragraphs.push(docxParagraph(rawLine.replace(/\*\*/g, '').replace(/`/g, ''), null));
    }
  }
  return paragraphs.join('');
}

function createDocx(outputPath, markdown, title) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${markdownToDocxBody(markdown)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`;
  const entries = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>NexoTico Servicios Tecnológicos, S.R.L.</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-11-17T12:00:00Z</dcterms:created></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>NexoTico Document Builder</Application></Properties>' }
  ];
  fs.writeFileSync(outputPath, zip(entries));
}

function normalPdfText(value) {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/[•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xff]/g, '?');
}

function wrapText(value, width) {
  const words = normalPdfText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current || current.length + word.length + 1 <= width) {
      current = current ? `${current} ${word}` : word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function markdownToPdfPages(markdown) {
  const pages = [];
  let page = [];
  const maxLines = 58;
  function addLine(line) {
    if (page.length >= maxLines) {
      pages.push(page);
      page = [];
    }
    page.push(line);
  }
  function forcePage() {
    pages.push(page.length ? page : ['']);
    page = [];
  }
  for (const rawLine of markdownLines(markdown)) {
    if (rawLine === '<!-- PAGE BREAK -->') {
      forcePage();
      continue;
    }
    if (!rawLine) {
      addLine('');
      continue;
    }
    let text = rawLine;
    if (text.startsWith('# ')) text = text.slice(2).toUpperCase();
    else if (text.startsWith('## ')) text = text.slice(3).toUpperCase();
    else if (text.startsWith('### ')) text = text.slice(4);
    else if (/^[-*] /.test(text)) text = `- ${text.slice(2)}`;
    else if (/^\d+\. /.test(text)) text = `- ${text.replace(/^\d+\. /, '')}`;
    else if (/^\|/.test(text)) text = text.replace(/\|/g, ' | ').replace(/^ \| | \| $/g, '');
    for (const wrapped of wrapText(text, 108)) addLine(wrapped);
  }
  if (page.length || !pages.length) pages.push(page);
  return pages;
}

function pdfEscaped(line) {
  return normalPdfText(line).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createPdf(outputPath, markdown, title) {
  const pages = markdownToPdfPages(markdown);
  const objects = new Map();
  const pageObjectIds = pages.map((_, index) => 4 + (index * 2));
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pages.forEach((lines, index) => {
    const pageId = 4 + (index * 2);
    const streamId = pageId + 1;
    const textLines = [`BT /F1 9 Tf 50 752 Td 12 TL (${pdfEscaped(title)}) Tj T*`];
    for (const line of lines) textLines.push(`(${pdfEscaped(line)}) Tj T*`);
    textLines.push(`/F1 8 Tf 0 -8 Td (Pagina ${index + 1} de ${pages.length}) Tj ET`);
    const stream = Buffer.from(textLines.join('\n'), 'latin1');
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.set(streamId, Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream', 'latin1')]));
  });

  const chunks = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'binary')];
  const offsets = [0];
  const highest = Math.max(...objects.keys());
  for (let id = 1; id <= highest; id += 1) {
    offsets[id] = Buffer.concat(chunks).length;
    const content = objects.get(id);
    chunks.push(Buffer.from(`${id} 0 obj\n`, 'latin1'), Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1'), Buffer.from('\nendobj\n', 'latin1'));
  }
  const startXref = Buffer.concat(chunks).length;
  let xref = `xref\n0 ${highest + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= highest; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${highest + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`, 'latin1'));
  fs.writeFileSync(outputPath, Buffer.concat(chunks));
  return pages.length;
}

function columnName(index) {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function xlsxCell(reference, value, style) {
  const styleAttribute = style === undefined ? '' : ` s="${style}"`;
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheetXml(rows) {
  const rowXml = rows.map((cells, rowIndex) => `<row r="${rowIndex + 1}">${cells.map((cell, cellIndex) => xlsxCell(`${columnName(cellIndex)}${rowIndex + 1}`, cell, rowIndex === 0 ? 1 : 0)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function metadata(markdown, label) {
  const match = markdown.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`));
  return match ? match[1].trim() : '';
}

function markdownSections(markdown) {
  const sections = [];
  let heading = 'Resumen';
  let content = [];
  for (const line of markdownLines(markdown)) {
    if (line.startsWith('## ')) {
      if (content.length) sections.push([heading, content.join('\n').trim()]);
      heading = line.slice(3);
      content = [];
    } else if (!line.startsWith('# ') && line !== '<!-- PAGE BREAK -->') {
      content.push(line);
    }
  }
  if (content.length) sections.push([heading, content.join('\n').trim()]);
  return sections;
}

function createXlsx(outputPath, policySources) {
  const sheets = [];
  const indexRows = [['Código', 'Política', 'Versión', 'Vigencia', 'Responsable', 'Archivo Markdown', 'Archivo DOCX', 'Archivo PDF']];
  policySources.forEach((source) => {
    const title = (source.markdown.match(/^#\s+(.+)$/m) || ['', source.basename])[1];
    indexRows.push([metadata(source.markdown, 'Código'), title, metadata(source.markdown, 'Versión'), metadata(source.markdown, 'Vigencia'), metadata(source.markdown, 'Responsable'), `${source.basename}.md`, `${source.basename}.docx`, `${source.basename}.pdf`]);
  });
  sheets.push({ name: 'Indice', rows: indexRows });
  policySources.forEach((source, index) => {
    sheets.push({ name: `${String(index + 1).padStart(2, '0')} ${source.basename.slice(3, 25)}`.slice(0, 31), rows: [['Sección', 'Contenido'], ...markdownSections(source.markdown)] });
  });

  const contentTypes = ['<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  sheets.forEach((_, index) => contentTypes.push(`<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`));
  contentTypes.push('</Types>');
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const workbookRelations = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const entries = [
    { name: '[Content_Types].xml', data: contentTypes.join('') },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelations}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>' },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: worksheetXml(sheet.rows) }))
  ];
  fs.writeFileSync(outputPath, zip(entries));
}

function build() {
  const policySources = fs.readdirSync(policiesDir)
    .filter((name) => /^\d{2}-.+\.md$/.test(name))
    .sort()
    .map((name) => ({ basename: name.slice(0, -3), markdown: fs.readFileSync(path.join(policiesDir, name), 'utf8') }));
  if (policySources.length !== 10) throw new Error(`Se esperaban 10 políticas Markdown y se encontraron ${policySources.length}.`);

  const reportPath = path.join(researchDir, 'informe-investigacion-rrhh-costa-rica.md');
  const report = fs.readFileSync(reportPath, 'utf8');
  let generated = 0;
  policySources.forEach((source) => {
    const title = (source.markdown.match(/^#\s+(.+)$/m) || ['', source.basename])[1];
    createDocx(path.join(policiesDir, `${source.basename}.docx`), source.markdown, title);
    createPdf(path.join(policiesDir, `${source.basename}.pdf`), source.markdown, title);
    generated += 2;
  });
  createDocx(path.join(researchDir, 'informe-investigacion-rrhh-costa-rica.docx'), report, 'Informe de investigación documental: Recursos Humanos y RAG');
  const reportPages = createPdf(path.join(researchDir, 'informe-investigacion-rrhh-costa-rica.pdf'), report, 'Informe de investigación documental: Recursos Humanos y RAG');
  createXlsx(path.join(policiesDir, 'matriz-conocimiento-politicas.xlsx'), policySources);
  console.log(JSON.stringify({ policyMarkdown: policySources.length, generatedDistributionFiles: generated + 3, reportPdfPages: reportPages, xlsxSheets: policySources.length + 1 }, null, 2));
}

build();
