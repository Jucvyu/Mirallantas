import { enviarDato, enviarLista } from './respuesta.view.js';

/**
 * Vista de los modelos de llanta. Como el resto del catálogo, no lleva
 * precios ni costos: las referencias van sin precio (salvo la llanta
 * reencauchada, que tiene precio fijo).
 */

/** Una referencia normal no lleva precio. */
function sinPrecio(r) {
  if (r.reencauchada) return r;
  const { precioVenta: _precio, ...resto } = r;
  return resto;
}

export function enviarModelos(res, { filas, total, pagina, porPagina }) {
  enviarLista(res, { filas, total, pagina, porPagina });
}

export function enviarModelo(res, modelo, estado = 200) {
  enviarDato(res, { ...modelo, referencias: (modelo.referencias ?? []).map(sinPrecio) }, estado);
}
