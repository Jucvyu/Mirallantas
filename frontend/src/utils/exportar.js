// =========================================================================
// Exportar datos a PDF, Excel (.xlsx) o CSV, en el navegador.
//
//   await exportar('pdf', {
//     nombre: 'Clientes',                 // nombre del archivo (sin extensión)
//     titulo: 'Clientes',                 // título dentro del documento
//     secciones: [{ titulo, columnas: ['Nombre', …], filas: [['Ana', …], …] }],
//   });
//
// Las librerías de PDF y Excel se descargan solo al exportar: así no pesan
// en el resto de la aplicación.
// =========================================================================

/** Formatos disponibles. */
export const FORMATOS = ['pdf', 'excel', 'csv'];

/** "Clientes" → "Clientes-2026-10-27" */
const nombreArchivo = (nombre, extension) =>
  `${nombre.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Exportacion'}-${new Date().toISOString().slice(0, 10)}.${extension}`;

/** Guarda un archivo en el equipo. */
function descargar(contenido, tipo, archivo) {
  const url = URL.createObjectURL(contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const texto = (valor) => (valor === null || valor === undefined ? '' : String(valor));

// ---- CSV ------------------------------------------------------------------
// Separado por punto y coma: así lo abre bien Excel en español (la coma es
// el separador decimal). Con BOM para que respete tildes y eñes.

function csv({ secciones }) {
  const celda = (v) => {
    const t = texto(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const bloques = secciones.map(({ titulo, columnas, filas }) => {
    const lineas = [columnas, ...filas].map((fila) => fila.map(celda).join(';'));
    return secciones.length > 1 ? [celda(titulo), ...lineas].join('\r\n') : lineas.join('\r\n');
  });
  return `﻿${bloques.join('\r\n\r\n')}`;
}

// ---- Excel (.xlsx) --------------------------------------------------------
// Un .xlsx es un ZIP con archivos XML: se arma a mano (una hoja por
// sección, encabezados en negrita) y se comprime con fflate.

const xml = (t) => texto(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** 0 → "A", 26 → "AA" */
function letraColumna(indice) {
  let letra = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  return letra;
}

function hojaXml({ columnas, filas }) {
  const todas = [columnas, ...filas];
  const anchos = columnas.map((_, c) => Math.min(60, Math.max(10, ...todas.map((f) => texto(f[c]).length + 2))));
  const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const filasXml = todas
    .map((fila, r) => {
      const celdas = fila
        .map((v, c) => `<c r="${letraColumna(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`)
        .join('');
      return `<row r="${r + 1}">${celdas}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${filasXml}</sheetData></worksheet>`;
}

async function excel({ secciones }) {
  const { zipSync, strToU8 } = await import('fflate');
  // Nombres de hoja: máximo 31 caracteres, sin símbolos prohibidos y sin repetir
  const usados = new Set();
  const nombres = secciones.map(({ titulo }, i) => {
    let base = texto(titulo || `Hoja ${i + 1}`).replace(/[\\/:*?[\]]/g, '').slice(0, 28) || `Hoja ${i + 1}`;
    let nombre = base;
    for (let n = 2; usados.has(nombre); n += 1) nombre = `${base} ${n}`;
    usados.add(nombre);
    return nombre;
  });
  const archivos = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${secciones
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres
      .map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${secciones
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${secciones.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBBF24"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
  };
  secciones.forEach((seccion, i) => {
    archivos[`xl/worksheets/sheet${i + 1}.xml`] = hojaXml(seccion);
  });
  const zip = zipSync(Object.fromEntries(Object.entries(archivos).map(([ruta, contenido]) => [ruta, strToU8(contenido)])));
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---- PDF ------------------------------------------------------------------

async function pdf({ titulo, secciones }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const muchasColumnas = secciones.some((s) => s.columnas.length > 5);
  const doc = new jsPDF({ orientation: muchasColumnas ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`MiraLlantas · ${texto(titulo)}`, 40, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado el ${new Date().toLocaleString('es-CO')}`, 40, 60);

  let y = 76;
  for (const { titulo: subtitulo, columnas, filas } of secciones) {
    if (secciones.length > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text(texto(subtitulo), 40, y + 10);
      y += 16;
    }
    autoTable(doc, {
      startY: y,
      head: [columnas.map(texto)],
      body: filas.length ? filas.map((f) => f.map(texto)) : [[{ content: 'Sin registros', colSpan: columnas.length }]],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [251, 191, 36], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    });
    y = doc.lastAutoTable.finalY + 24;
  }
  return doc.output('blob');
}

/** Genera el archivo en el formato elegido y lo descarga. */
export async function exportar(formato, datos) {
  const nombre = datos.nombre ?? datos.titulo;
  if (formato === 'csv') return descargar(csv(datos), 'text/csv;charset=utf-8', nombreArchivo(nombre, 'csv'));
  if (formato === 'excel') return descargar(await excel(datos), '', nombreArchivo(nombre, 'xlsx'));
  if (formato === 'pdf') return descargar(await pdf(datos), 'application/pdf', nombreArchivo(nombre, 'pdf'));
  throw new Error('Formato de exportación no válido.');
}

/**
 * Texto plano de lo que muestra una celda (para exportarla). Si la columna
 * pinta algo propio (insignias, enlaces…) se toma el texto que contiene; si
 * no hay texto, el valor del registro.
 */
export function textoDeNodo(nodo) {
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDeNodo).filter(Boolean).join(' ');
  if (typeof nodo === 'object' && nodo.props) return textoDeNodo(nodo.props.children);
  return '';
}
