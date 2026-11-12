// =========================================================================
// Ficha técnica en PDF, armada con los datos que se cargaron en el panel.
//
// La usa la página de detalle de un producto cuando el cliente quiere
// descargar la ficha. Si el admin subió el PDF del fabricante, ese se ofrece
// aparte. Las librerías de PDF se descargan solo al pedirla.
// =========================================================================

const siNo = (v) => (v === true ? 'Sí' : v === false ? 'No' : null);
const conUnidad = (v, unidad) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toLocaleString('es-CO')} ${unidad}`);

/** Filas etiqueta / valor de la ficha del producto (solo las que tienen dato). */
export function datosFicha(p) {
  return [
    ['Condición', p.reencauchada ? 'Reencauchada · única unidad' : null],
    ['Marca', p.reencauchada ? null : p.marca],
    ['Categoría', p.categoria],
    ['Tipo de vehículo', p.tipoVehiculo || null],
    ['Construcción', p.construccion],
    ['Uso', p.uso],
    ['Labrado', p.labrado],
    ['Sin cámara (tubeless)', siNo(p.sinCamara)],
    ['Recauchable', siNo(p.recauchable)],
    ['Garantía', p.garantiaMeses === null || p.garantiaMeses === undefined || p.garantiaMeses === '' ? null : `${p.garantiaMeses} meses`],
    ['País de origen', p.paisOrigen],
  ].filter(([, valor]) => valor);
}

/** Nombre que se muestra: la reencauchada se reconoce por su descripción. */
export const tituloDe = (p) => (p.reencauchada ? p.descripcion || p.nombre : `${p.marca} ${p.nombre}`);

/** Columnas y filas de la tabla de medidas. */
export const COLUMNAS_MEDIDAS = ['Medida', 'Posición', 'Índice de carga', 'Lonas', 'Labrado', 'Peso', 'Código'];
export const filaMedida = (r) => [
  r.medidas,
  r.posicion || '—',
  r.indiceCarga || '—',
  r.lonas ? `${r.lonas} PR` : '—',
  conUnidad(r.profundidadLabrado, 'mm'),
  conUnidad(r.pesoKg, 'kg'),
  r.codigo,
];

/** Genera la ficha y la descarga como "Ficha técnica - Marca Nombre.pdf". */
export async function descargarFichaTecnica(producto, referencias) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const titulo = tituloDe(producto);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(180, 120, 0);
  doc.text('MIRALLANTAS · FICHA TÉCNICA', 40, 44);
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(titulo, 40, 70);

  let y = 84;
  if (producto.descripcion && !producto.reencauchada) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lineas = doc.splitTextToSize(producto.descripcion, 515);
    doc.text(lineas, 40, y + 4);
    y += lineas.length * 13 + 8;
  }

  const estilo = {
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [251, 191, 36], textColor: [15, 23, 42], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  };

  autoTable(doc, {
    ...estilo,
    startY: y + 6,
    head: [['Característica', 'Valor']],
    body: datosFicha(producto),
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 170 } },
  });

  autoTable(doc, {
    ...estilo,
    startY: doc.lastAutoTable.finalY + 22,
    head: [COLUMNAS_MEDIDAS],
    body: referencias.map(filaMedida),
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Generada el ${new Date().toLocaleDateString('es-CO')}. El precio se confirma en la cotización.`,
    40,
    doc.internal.pageSize.getHeight() - 30,
  );

  doc.save(`Ficha técnica - ${titulo}.pdf`);
}
