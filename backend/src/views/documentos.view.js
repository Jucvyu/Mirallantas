import { enviarDato, enviarLista, omitir } from './respuesta.view.js';

/**
 * Vista de los documentos comerciales (cotizaciones, ventas, compras).
 *
 * El proveedor es un dato interno de la compra: a un cliente del portal no
 * se le envía. Esta vista es la que decide qué campos ve cada quien.
 */
const INTERNOS = ['proveedorId', 'proveedor'];

/** Quita los datos internos si quien pregunta es un cliente del portal. */
const paraSesion = (documento, esCliente) => (esCliente ? omitir(documento, INTERNOS) : documento);

/** Listado de documentos. */
export function enviarDocumentos(res, { filas, total, pagina, porPagina }, esCliente = false) {
  enviarLista(res, { filas: filas.map((f) => paraSesion(f, esCliente)), total, pagina, porPagina });
}

/** Un documento con sus líneas de detalle. */
export function enviarDocumento(res, documento, esCliente = false, estado = 200) {
  enviarDato(res, paraSesion(documento, esCliente), estado);
}
