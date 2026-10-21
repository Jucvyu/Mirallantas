// =========================================================================
// Solicitud de cotización por WhatsApp.
//
// No envía nada por sí sola: arma un enlace https://wa.me/… con el mensaje
// ya escrito. Al abrirlo, el cliente lo revisa y decide enviarlo desde
// WhatsApp. El mensaje lleva solo el nombre del cliente, el lugar de
// despacho y lo que pide con sus cantidades: nunca precios, costos ni stock.
// =========================================================================

/** Texto del mensaje (los saltos de línea se conservan). */
export function mensajeCotizacion({ nombre, lugar, productos = [], servicios = [] }) {
  const lineas = [`Hola, soy ${nombre}. Quiero solicitar una cotización.`, '', `Lugar de despacho: ${lugar}`];
  if (productos.length > 0) {
    lineas.push('', 'Llantas:');
    productos.forEach((p, i) => {
      const datos = [`${p.marca} ${p.nombre}`.trim(), `Medida ${p.medidas}`, p.codigo ? `Ref. ${p.codigo}` : null, `Cantidad: ${p.cantidad}`];
      lineas.push(`${i + 1}. ${datos.filter(Boolean).join(' · ')}`);
    });
  }
  if (servicios.length > 0) {
    lineas.push('', 'Servicios:');
    servicios.forEach((s, i) => {
      const datos = [s.servicio, s.medidas ? `Medida ${s.medidas}` : null, `Cantidad: ${s.cantidad}`];
      lineas.push(`${i + 1}. ${datos.filter(Boolean).join(' · ')}`);
    });
  }
  return lineas.join('\n');
}

/**
 * Enlace de WhatsApp con el mensaje codificado (espacios, saltos de línea,
 * tildes y símbolos). `numero` va solo con dígitos e indicativo de país.
 */
export function enlaceWhatsApp(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
