// =========================================================================
// Servicio de las listas del sistema: tipos de documento, métodos y medios
// de pago. Viven en la base de datos; se piden una vez al abrir la app.
// =========================================================================

import { mediosPago, metodosPago, tiposDocumento } from '../constantes';
import { api } from './http';

/** Cambia el contenido de un arreglo sin cambiar el arreglo (otros lo importan). */
function reemplazar(lista, valores) {
  lista.splice(0, lista.length, ...valores);
}

/** Pide las listas a la API (GET /referencias) y llena las de constantes.js. */
export async function cargarReferencias() {
  const datos = await api('/referencias');
  reemplazar(
    tiposDocumento,
    datos.tiposDocumento.map((t) => t.codigo),
  );
  reemplazar(metodosPago, datos.metodosPago);
  reemplazar(mediosPago, datos.mediosPago);
}
