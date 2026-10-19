import { enviarDato, enviarLista } from './respuesta.view.js';

/**
 * Vista de productos. El precio de compra es un dato interno: a un
 * cliente del portal nunca se le envía.
 */

/** Quita el precio de compra si quien pregunta es un cliente del portal. */
export function paraSesion(producto, esCliente) {
  if (!esCliente) return producto;
  const { precioCompra: _oculto, ...publico } = producto;
  return publico;
}

export function enviarCatalogo(res, { filas, total, pagina, porPagina }, esCliente) {
  enviarLista(res, { filas: filas.map((p) => paraSesion(p, esCliente)), total, pagina, porPagina });
}

export function enviarProducto(res, producto, esCliente = false, estado = 200) {
  enviarDato(res, paraSesion(producto, esCliente), estado);
}
