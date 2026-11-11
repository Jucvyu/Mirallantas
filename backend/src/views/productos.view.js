import { enviarDato, enviarLista } from './respuesta.view.js';

/**
 * Vista de productos. El catálogo y la gestión de productos no llevan
 * precios ni costos; el catálogo público, además, solo envía los datos que
 * ve un visitante. La excepción es la llanta reencauchada: una sola unidad
 * con precio fijo, que sí lo muestra.
 */

const PUBLICOS = ['id', 'codigo', 'nombre', 'descripcion', 'medidas', 'categoria', 'colorCategoria', 'marca', 'tipoVehiculo', 'foto'];

/** Lo que solo lleva la llanta reencauchada (su precio fijo). */
const DE_REENCAUCHADA = ['reencauchada', 'precioVenta'];

/** Un producto normal no lleva precio: se quita el campo. */
function sinPrecio(p) {
  if (p.reencauchada) return p;
  const { precioVenta: _precio, ...resto } = p;
  return resto;
}

/** Solo los campos públicos de un producto (catálogo sin sesión). */
function publico(p) {
  const campos = p.reencauchada ? [...PUBLICOS, ...DE_REENCAUCHADA] : PUBLICOS;
  return Object.fromEntries(campos.map((campo) => [campo, p[campo] ?? null]));
}

export function enviarCatalogo(res, { filas, total, pagina, porPagina }) {
  enviarLista(res, { filas: filas.map(sinPrecio), total, pagina, porPagina });
}

export function enviarCatalogoPublico(res, { filas, total, pagina, porPagina }) {
  enviarLista(res, { filas: filas.map(publico), total, pagina, porPagina });
}

export function enviarProducto(res, producto, estado = 200) {
  enviarDato(res, sinPrecio(producto), estado);
}
