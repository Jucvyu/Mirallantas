import PDFDocument from 'pdfkit';
import { CUOTA_INICIAL_PORCENTAJE, VIGENCIA_COTIZACION_DIAS } from '../reglas.js';

/**
 * Vista de documentos PDF: la cotización formal y el comprobante de venta.
 *
 * Se arman con los datos guardados en la base (nunca con valores que mande
 * el navegador) y se envían como descarga. Los datos de la empresa salen de
 * la tabla `empresa`: si un dato no está registrado, simplemente no se
 * imprime (no se inventa).
 */

// ---- Formato ---------------------------------------------------------------

const MARGEN = 50;
const COLOR_ACENTO = '#F59E0B';
const COLOR_TEXTO = '#0F172A';
const COLOR_SUAVE = '#64748B';
const COLOR_LINEA = '#E2E8F0';

/** 1500000 → "$ 1.500.000" (pesos colombianos, sin decimales). */
const pesos = (valor) => `$ ${Number(valor || 0).toLocaleString('es-CO')}`;

/** "2026-10-20" → "2026-10-20" (formato estándar; sin pasar por Date: no hay desfase de zona horaria). */
const fechaCorta = (fecha) => {
  if (!fecha) return '—';
  // Formato estándar del sistema: AAAA-MM-DD
  return String(fecha).slice(0, 10);
};

// ---- Piezas comunes --------------------------------------------------------

/** Encabezado: datos de la empresa a la izquierda y el documento a la derecha. */
function encabezado(doc, empresa, { titulo, numero, filas }) {
  const ancho = doc.page.width - MARGEN * 2;
  const y = MARGEN;

  doc.fillColor(COLOR_TEXTO).font('Helvetica-Bold').fontSize(18).text(empresa?.nombre ?? 'MiraLlantas', MARGEN, y, {
    width: ancho * 0.55,
  });
  const datosEmpresa = [
    empresa?.razonSocial && empresa.razonSocial !== empresa.nombre ? empresa.razonSocial : null,
    empresa?.nit ? `NIT ${empresa.nit}` : null,
    [empresa?.direccion, empresa?.ciudad].filter(Boolean).join(', ') || null,
    [empresa?.telefono, empresa?.correo].filter(Boolean).join(' · ') || null,
  ].filter(Boolean);
  doc.font('Helvetica').fontSize(9).fillColor(COLOR_SUAVE);
  for (const linea of datosEmpresa) doc.text(linea, { width: ancho * 0.55 });
  const finEmpresa = doc.y;

  // Recuadro del documento
  const xDoc = MARGEN + ancho * 0.58;
  const anchoDoc = ancho * 0.42;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLOR_ACENTO).text(titulo, xDoc, y, { width: anchoDoc, align: 'right' });
  doc.fontSize(11).fillColor(COLOR_TEXTO).text(numero, xDoc, doc.y, { width: anchoDoc, align: 'right' });
  // Cada dato en su fila: la etiqueta a la izquierda y el valor a la derecha
  for (const [etiqueta, valor] of filas) {
    const yFila = doc.y + 3;
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_SUAVE).text(etiqueta, xDoc, yFila, { width: anchoDoc * 0.5 });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXTO).text(valor, xDoc + anchoDoc * 0.5, yFila, {
      width: anchoDoc * 0.5,
      align: 'right',
    });
  }

  const fin = Math.max(finEmpresa, doc.y) + 12;
  doc.moveTo(MARGEN, fin).lineTo(MARGEN + ancho, fin).lineWidth(2).strokeColor(COLOR_ACENTO).stroke();
  doc.y = fin + 14;
}

/** Recuadro con los datos del cliente. */
function datosCliente(doc, cliente) {
  const ancho = doc.page.width - MARGEN * 2;
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_SUAVE).text('CLIENTE', MARGEN, y);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_TEXTO).text(cliente?.nombre ?? '—', MARGEN, doc.y + 2, {
    width: ancho,
  });
  doc.font('Helvetica').fontSize(9).fillColor(COLOR_SUAVE);
  const lineas = [
    cliente?.numeroDocumento ? `${cliente.tipoDocumento} ${cliente.numeroDocumento}` : null,
    cliente?.direccion ? `Dirección: ${cliente.direccion}` : null,
    [cliente?.telefono, cliente?.correo].filter(Boolean).join(' · ') || null,
  ].filter(Boolean);
  for (const linea of lineas) doc.text(linea, { width: ancho });
  doc.y += 14;
}

const COLUMNAS = [
  { titulo: 'Código', ancho: 0.13, clave: 'codigo' },
  { titulo: 'Descripción', ancho: 0.33, clave: 'descripcion' },
  { titulo: 'Medida', ancho: 0.13, clave: 'medida' },
  { titulo: 'Cant.', ancho: 0.07, clave: 'cantidad', alinear: 'right' },
  { titulo: 'Precio unit.', ancho: 0.16, clave: 'unitario', alinear: 'right' },
  { titulo: 'Subtotal', ancho: 0.18, clave: 'subtotal', alinear: 'right' },
];

/** Fila de títulos de la tabla. */
function tituloTabla(doc) {
  const ancho = doc.page.width - MARGEN * 2;
  const y = doc.y;
  doc.rect(MARGEN, y, ancho, 20).fill('#F8FAFC');
  let x = MARGEN + 6;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_SUAVE);
  for (const c of COLUMNAS) {
    const w = ancho * c.ancho - 8;
    doc.text(c.titulo.toUpperCase(), x, y + 6, { width: w, align: c.alinear ?? 'left' });
    x += ancho * c.ancho;
  }
  doc.y = y + 24;
}

/** Tabla de líneas; pasa a otra página si no cabe (repitiendo los títulos). */
function tabla(doc, filas) {
  const ancho = doc.page.width - MARGEN * 2;
  tituloTabla(doc);
  for (const fila of filas) {
    doc.font('Helvetica').fontSize(9);
    const alto = Math.max(
      ...COLUMNAS.map((c) => doc.heightOfString(String(fila[c.clave] ?? ''), { width: ancho * c.ancho - 8 })),
    );
    if (doc.y + alto + 10 > doc.page.height - MARGEN - 60) {
      doc.addPage();
      tituloTabla(doc);
    }
    const y = doc.y;
    let x = MARGEN + 6;
    for (const c of COLUMNAS) {
      const w = ancho * c.ancho - 8;
      doc.fillColor(c.clave === 'descripcion' ? COLOR_TEXTO : COLOR_SUAVE)
        .font(c.clave === 'subtotal' ? 'Helvetica-Bold' : 'Helvetica')
        .text(String(fila[c.clave] ?? ''), x, y, { width: w, align: c.alinear ?? 'left' });
      if (fila.nota && c.clave === 'descripcion') {
        doc.fontSize(7.5).fillColor(COLOR_ACENTO).text(fila.nota, x, doc.y, { width: w });
        doc.fontSize(9);
      }
      x += ancho * c.ancho;
    }
    const fin = Math.max(y + alto, doc.y) + 6;
    doc.moveTo(MARGEN, fin).lineTo(MARGEN + ancho, fin).lineWidth(0.5).strokeColor(COLOR_LINEA).stroke();
    doc.y = fin + 6;
  }
  if (filas.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_SUAVE).text('Sin líneas de detalle registradas.', MARGEN + 6);
    doc.y += 8;
  }
}

/** Totales alineados a la derecha; el último va destacado. */
function totales(doc, filas) {
  const ancho = doc.page.width - MARGEN * 2;
  const x = MARGEN + ancho * 0.5;
  const w = ancho * 0.5;
  if (doc.y + filas.length * 18 + 20 > doc.page.height - MARGEN - 60) doc.addPage();
  doc.y += 4;
  filas.forEach(([etiqueta, valor], i) => {
    const ultimo = i === filas.length - 1;
    const y = doc.y;
    if (ultimo) doc.rect(x, y - 4, w, 24).fill('#FEF3C7');
    doc.font(ultimo ? 'Helvetica-Bold' : 'Helvetica').fontSize(ultimo ? 12 : 9.5).fillColor(ultimo ? COLOR_TEXTO : COLOR_SUAVE);
    doc.text(etiqueta, x + 8, y + (ultimo ? 2 : 0), { width: w * 0.55 });
    doc.font('Helvetica-Bold').fillColor(COLOR_TEXTO).text(valor, x + w * 0.45, y + (ultimo ? 2 : 0), {
      width: w * 0.55 - 8,
      align: 'right',
    });
    doc.y = y + (ultimo ? 26 : 17);
  });
}

/** Bloque de texto (condiciones, observaciones). */
function nota(doc, titulo, lineas) {
  const ancho = doc.page.width - MARGEN * 2;
  if (doc.y + 30 + lineas.length * 14 > doc.page.height - MARGEN - 40) doc.addPage();
  doc.y += 8;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TEXTO).text(titulo, MARGEN, doc.y, { width: ancho });
  doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_SUAVE);
  for (const linea of lineas) doc.text(`• ${linea}`, MARGEN, doc.y + 2, { width: ancho });
}

/** Pie con la numeración de páginas. */
function pie(doc, texto) {
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i += 1) {
    doc.switchToPage(rango.start + i);
    // El pie va dentro del margen inferior: sin esto PDFKit abriría otra página
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGEN + 10;
    doc.font('Helvetica').fontSize(7.5).fillColor(COLOR_SUAVE);
    doc.text(`${texto} · Página ${i + 1} de ${rango.count}`, MARGEN, y, {
      width: doc.page.width - MARGEN * 2,
      align: 'center',
      lineBreak: false,
    });
  }
}

/** Crea el documento y lo envía como descarga al terminar. */
function nuevoDocumento(res, nombreArchivo) {
  const doc = new PDFDocument({ size: 'LETTER', margin: MARGEN, bufferPages: true, info: { Title: nombreArchivo } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
  doc.pipe(res);
  return doc;
}

/** Filas de la tabla a partir de las líneas guardadas. */
function filasDeLineas(lineas, { enVenta = false } = {}) {
  return lineas.map((l) => {
    const esServicio = l.tipo === 'servicio';
    const precio = esServicio ? l.precioServicio : l.precioUnitario;
    return {
      codigo: l.codigoProducto ?? (esServicio ? 'Servicio' : ''),
      descripcion: l.descripcion,
      nota: esServicio ? 'Reencauche: se paga aparte' : null,
      // En la venta solo cuentan las llantas: el servicio tiene su propio pago
      medida: l.medida ?? '',
      cantidad: l.cantidad,
      unitario: esServicio ? '' : pesos(precio),
      subtotal: esServicio ? (enVenta ? 'Aparte' : precio ? pesos(precio) : 'Por definir') : pesos(l.subtotal),
    };
  });
}

// ---- Documentos ------------------------------------------------------------

/**
 * Cotización formal en PDF: empresa, cliente, llantas con sus precios
 * confirmados, total y vigencia (la que guardó la base al emitirla).
 */
export function enviarPdfCotizacion(res, { empresa, cotizacion, cliente, lineas }) {
  const doc = nuevoDocumento(res, `Cotizacion-${cotizacion.numero}`);
  const filasDoc = [
    ['Fecha de emisión', fechaCorta(cotizacion.emitidaEn)],
    ['Válida hasta', fechaCorta(cotizacion.venceEn)],
  ];
  if (cotizacion.metodoPago) filasDoc.push(['Pago', cotizacion.metodoPago === 'Crédito' ? `Crédito a ${cotizacion.plazoDias} días` : 'Contado']);
  encabezado(doc, empresa, { titulo: 'COTIZACIÓN', numero: cotizacion.numero, filas: filasDoc });
  datosCliente(doc, cliente);
  tabla(doc, filasDeLineas(lineas));

  const servicios = lineas.filter((l) => l.tipo === 'servicio').reduce((s, l) => s + (l.precioServicio ?? 0), 0);
  const filasTotales = [['Subtotal llantas', pesos(cotizacion.subtotal)]];
  if (cotizacion.interes > 0) filasTotales.push([`Interés del crédito (${cotizacion.plazoDias} días)`, pesos(cotizacion.interes)]);
  if (servicios > 0) filasTotales.push(['Servicios de reencauche (aparte)', pesos(servicios)]);
  filasTotales.push([servicios > 0 ? 'VALOR TOTAL' : 'TOTAL', pesos(cotizacion.total + servicios)]);
  totales(doc, filasTotales);

  const condiciones = [
    `Vigencia: ${VIGENCIA_COTIZACION_DIAS} días calendario desde la emisión (hasta el ${fechaCorta(cotizacion.venceEn)}). Después de esa fecha los precios deben confirmarse de nuevo.`,
    'Precios en pesos colombianos (COP), confirmados con nuestros proveedores al emitir la cotización.',
    `A crédito se paga una cuota inicial de al menos el ${CUOTA_INICIAL_PORCENTAJE} % del total; el saldo se financia con el interés del plazo elegido.`,
  ];
  if (servicios > 0) condiciones.push('Los servicios de reencauche se facturan y pagan aparte de las llantas.');
  if (cotizacion.direccionEntrega) condiciones.push(`Despacho a: ${cotizacion.direccionEntrega}.`);
  nota(doc, 'Condiciones comerciales', condiciones);

  pie(doc, 'Documento generado por MiraLlantas ERP. No es una factura electrónica');
  doc.end();
}

/** Comprobante de una venta registrada (no es factura electrónica). */
export function enviarPdfVenta(res, { empresa, venta, cliente, lineas }) {
  const doc = nuevoDocumento(res, `Comprobante-${venta.numero}`);
  const filasDoc = [
    ['Fecha', fechaCorta(venta.fecha)],
    ['Pago', venta.metodoPago === 'Crédito' ? 'Crédito' : 'Contado'],
  ];
  if (venta.cotizacion) filasDoc.push(['Cotización', venta.cotizacion]);
  encabezado(doc, empresa, { titulo: 'COMPROBANTE DE VENTA', numero: venta.numero, filas: filasDoc });
  datosCliente(doc, cliente);
  tabla(doc, filasDeLineas(lineas, { enVenta: true }));

  const filasTotales = [];
  if (venta.interes > 0) {
    filasTotales.push(['Valor de los productos', pesos(venta.total - venta.interes)]);
    filasTotales.push(['Interés del crédito', pesos(venta.interes)]);
  }
  if (venta.metodoPago === 'Crédito') {
    filasTotales.push(['Cuota inicial pagada', pesos(venta.cuotaInicial)]);
    filasTotales.push(['Saldo financiado', pesos(venta.total - venta.cuotaInicial)]);
  }
  filasTotales.push(['TOTAL DE LA VENTA', pesos(venta.total)]);
  totales(doc, filasTotales);

  const observaciones = [`Estado de la venta: ${venta.estado}. Entrega: ${venta.estadoEntrega}.`];
  if (venta.estado === 'Anulada') observaciones.unshift('ESTA VENTA FUE ANULADA: el comprobante no tiene validez.');
  observaciones.push('Comprobante interno de la venta. No reemplaza la factura electrónica.');
  nota(doc, 'Observaciones', observaciones);

  pie(doc, 'Documento generado por MiraLlantas ERP');
  doc.end();
}

// ---- Comprobante de abono (tirilla) ---------------------------------------------

/** Ancho de una tirilla de 80 mm, en puntos (1 mm = 2,8346 pt). */
const ANCHO_TIRILLA = 227;
const MARGEN_TIRILLA = 12;

/**
 * Comprobante de un abono confirmado, en formato tirilla (80 mm de ancho,
 * como un recibo de caja). Solo con los datos guardados del abono.
 */
export function enviarPdfAbono(res, { empresa, abono }) {
  const nombre = `Abono-${abono.numero}`;
  const doc = new PDFDocument({
    size: [ANCHO_TIRILLA, 470],
    margin: MARGEN_TIRILLA,
    info: { Title: nombre },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
  doc.pipe(res);

  const ancho = ANCHO_TIRILLA - MARGEN_TIRILLA * 2;
  const x = MARGEN_TIRILLA;
  const centro = (texto, { tam = 8, negrita = false, color = COLOR_TEXTO } = {}) =>
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(tam).fillColor(color).text(texto, x, doc.y, { width: ancho, align: 'center' });
  const separador = (guion = '-') => {
    doc.moveDown(0.3);
    centro(guion.repeat(46), { tam: 7, color: COLOR_SUAVE });
    doc.moveDown(0.3);
  };
  const fila = (etiqueta, valor, { negrita = false, tam = 8 } = {}) => {
    const y = doc.y;
    doc.font('Helvetica').fontSize(tam).fillColor(COLOR_SUAVE).text(etiqueta, x, y, { width: ancho * 0.42 });
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(tam).fillColor(COLOR_TEXTO)
      .text(valor, x + ancho * 0.42, y, { width: ancho * 0.58, align: 'right' });
    doc.moveDown(0.2);
  };

  // Empresa (lo que no está registrado no se imprime)
  centro((empresa?.nombre ?? 'MiraLlantas').toUpperCase(), { tam: 12, negrita: true });
  for (const linea of [
    empresa?.razonSocial && empresa.razonSocial !== empresa.nombre ? empresa.razonSocial : null,
    empresa?.nit ? `NIT ${empresa.nit}` : null,
    [empresa?.direccion, empresa?.ciudad].filter(Boolean).join(', ') || null,
    empresa?.telefono ? `Tel. ${empresa.telefono}` : null,
  ].filter(Boolean)) {
    centro(linea, { tam: 7, color: COLOR_SUAVE });
  }

  separador('=');
  centro('COMPROBANTE DE ABONO', { tam: 10, negrita: true, color: COLOR_ACENTO });
  doc.moveDown(0.4);
  fila('Documento', abono.numero, { negrita: true });
  fila('Fecha', String(abono.fecha).slice(0, 10));
  fila('Cliente', abono.cliente ?? '—');
  if (abono.numeroDocumento) fila('Documento cliente', `${abono.tipoDocumento ?? ''} ${abono.numeroDocumento}`.trim());
  fila('Crédito', abono.credito);
  if (abono.factura) fila('Factura', abono.factura);
  fila('Medio de pago', abono.medioPago);

  separador();
  fila('MONTO ABONADO', pesos(abono.monto), { negrita: true, tam: 10 });
  if (abono.saldoCredito !== undefined && abono.saldoCredito !== null) fila('Saldo del crédito', pesos(abono.saldoCredito));
  separador('=');

  if (empresa?.correo) centro(empresa.correo, { tam: 7, color: COLOR_SUAVE });
  centro('Abono validado por MiraLlantas.', { tam: 7, color: COLOR_SUAVE });
  centro('Comprobante interno. No es factura electrónica.', { tam: 6, color: COLOR_SUAVE });
  doc.end();
}
