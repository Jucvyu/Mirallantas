import { enviarDato, enviarLista } from './respuesta.view.js';

/**
 * Vista de productos. El catálogo y la gestión de productos no llevan
 * precios ni costos (el modelo no los consulta); el catálogo público,
 * además, solo envía los datos que ve un visitante.
 */

const PUBLICOS = ['id', 'codigo', 'nombre', 'descripcion', 'medidas', 'categoria', 'colorCategoria', 'marca', 'tipoVehiculo', 'foto'];

/** Solo los campos públicos de un producto (catálogo sin sesión). */
const publico = (p) => Object.fromEntries(PUBLICOS.map((campo) => [campo, p[campo] ?? null]));

export function enviarCatalogo(res, { filas, total, pagina, porPagina }) {
  enviarLista(res, { filas, total, pagina, porPagina });
}

export function enviarCatalogoPublico(res, { filas, total, pagina, porPagina }) {
  enviarLista(res, { filas: filas.map(publico), total, pagina, porPagina });
}

export function enviarProducto(res, producto, estado = 200) {
  enviarDato(res, producto, estado);
}
