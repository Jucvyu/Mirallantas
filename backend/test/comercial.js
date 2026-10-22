/**
 * Ayudas de las pruebas para el flujo comercial:
 * solicitud → cotización formal (precios confirmados) → aceptación.
 */

// Imagen PNG real de 1×1 píxel, para consignaciones y comprobantes
export const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Cuerpo de una solicitud de cotización. */
export const solicitud = (lineas, extra = {}) => ({
  direccionEntrega: 'Cra 5 #10-22, Pereira',
  lineas,
  ...extra,
});

/**
 * El asesor verifica las llantas con el proveedor 1 y emite la cotización
 * formal con el precio de venta sugerido del catálogo.
 */
export async function emitir(e, tokenAsesor, numero) {
  const detalle = (await e.api(`/cotizaciones/${numero}`, { token: tokenAsesor })).cuerpo.datos.detalle;
  // Primero el precio de cada reencauche (sin él no se puede emitir)
  for (const l of detalle.filter((d) => d.tipo === 'servicio' && !d.precioServicio && d.solicitudServicio)) {
    await e.api(`/solicitudes-servicio/${l.solicitudServicio}`, {
      metodo: 'PATCH',
      token: tokenAsesor,
      cuerpo: { costo: 60000, precio: 72000 },
    });
  }
  const lineas = detalle
    .filter((l) => l.tipo === 'producto')
    .map((l) => ({
      id: l.id,
      proveedorId: 1,
      // Compra: lo que cobra el proveedor (aquí, el 80 % del precio de venta)
      costoProveedor: Math.round(l.precioSugerido * 0.8),
      precioUnitario: l.precioSugerido,
    }));
  return e.api(`/cotizaciones/${numero}/emitir`, { metodo: 'POST', token: tokenAsesor, cuerpo: { lineas } });
}

/** Acepta la cotización: el cliente desde el portal o el asesor por él. */
export function aceptar(e, token, numero, cuerpo, { desdePortal = true } = {}) {
  const ruta = desdePortal ? `/portal/cotizaciones/${numero}/aceptar` : `/cotizaciones/${numero}/aceptar`;
  return e.api(ruta, { metodo: 'POST', token, cuerpo });
}

/** Solicitud + emisión de una vez; devuelve el número de la cotización formal. */
export async function cotizacionEmitida(e, { token, tokenAsesor, lineas, extra }) {
  const r = await e.api('/cotizaciones', { metodo: 'POST', token, cuerpo: solicitud(lineas, extra) });
  if (r.estado !== 201) throw new Error(`No se creó la solicitud: ${JSON.stringify(r.cuerpo)}`);
  const emitida = await emitir(e, tokenAsesor, r.cuerpo.datos.numero);
  if (emitida.estado !== 200) throw new Error(`No se emitió: ${JSON.stringify(emitida.cuerpo)}`);
  return r.cuerpo.datos.numero;
}
