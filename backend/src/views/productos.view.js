import { enviarDato, enviarLista } from './respuesta.view.js';

/**
 * Vista de productos. Al cliente del portal no se le envía el costo
 * (precio de compra) ni el precio de venta exacto: solo el rango de precio
 * orientativo (precioMinimo – precioMaximo). El precio definitivo se lo da
 * la cotización formal.
 */

/** Deja solo los datos públicos si quien pregunta es un cliente del portal. */
export function paraSesion(producto, esCliente) {
  if (!esCliente) return producto;
  const { precioCompra: _costo, precioVenta: _precio, ...publico } = producto;
  return publico;
}

export function enviarCatalogo(res, { filas, total, pagina, porPagina }, esCliente) {
  enviarLista(res, { filas: filas.map((p) => paraSesion(p, esCliente)), total, pagina, porPagina });
}

export function enviarProducto(res, producto, esCliente = false, estado = 200) {
  enviarDato(res, paraSesion(producto, esCliente), estado);
}
