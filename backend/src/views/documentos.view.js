import { CAMPOS_INTERNOS_LINEA } from '../models/cotizaciones.model.js';
import { enviarDato, enviarLista, omitir } from './respuesta.view.js';

/**
 * Vista de los documentos comerciales (cotizaciones, ventas, compras).
 *
 * El proveedor, su costo confirmado, el precio sugerido y el último costo
 * de compra son datos internos: a un cliente del portal no se le envían.
 * Esta vista es la que decide qué campos ve cada quien.
 */
const INTERNOS = ['proveedorId', 'proveedor'];

/** Quita los datos internos (de la cabecera y de cada línea) si es un cliente del portal. */
function paraSesion(documento, esCliente) {
  if (!esCliente) return documento;
  const publico = omitir(documento, INTERNOS);
  if (publico.detalle) publico.detalle = publico.detalle.map((l) => omitir(l, CAMPOS_INTERNOS_LINEA));
  return publico;
}

/** Listado de documentos. */
export function enviarDocumentos(res, { filas, total, pagina, porPagina }, esCliente = false) {
  enviarLista(res, { filas: filas.map((f) => paraSesion(f, esCliente)), total, pagina, porPagina });
}

/** Un documento con sus líneas de detalle. */
export function enviarDocumento(res, documento, esCliente = false, estado = 200) {
  enviarDato(res, paraSesion(documento, esCliente), estado);
}
