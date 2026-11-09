// =========================================================================
// Servicio de las listas del sistema: tipos de documento, métodos de pago
// y diseños de banda.
// Viven en la base de datos; se piden al abrir la app.
//
// Si la API todavía no responde (p. ej. arrancando en Render), se reintenta en
// segundo plano hasta lograrlo: sin esto, los formularios se quedarían
// diciendo que no hay métodos de pago hasta recargar la página.
// =========================================================================

import { disenosBanda, mediosPago, metodosPago, tiposDocumento } from '../constantes';
import { api } from './http';

const ESPERA_REINTENTO_MS = 5000;

/** Sube cada vez que las listas se llenan; lo escuchan los formularios abiertos. */
let version = 0;
let reintentando = false;
const oyentes = new Set();

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
  reemplazar(disenosBanda, datos.disenosBanda ?? []);
  version += 1;
  oyentes.forEach((avisar) => avisar());
}

/** Tras una carga fallida, vuelve a intentarlo cada pocos segundos hasta lograrlo. */
export function reintentarReferencias() {
  if (reintentando) return;
  reintentando = true;
  const intentar = () =>
    cargarReferencias()
      .then(() => {
        reintentando = false;
      })
      .catch(() => setTimeout(intentar, ESPERA_REINTENTO_MS));
  setTimeout(intentar, ESPERA_REINTENTO_MS);
}

/** Para useSyncExternalStore: redibuja a quien muestre las listas cuando llegan. */
export function suscribirReferencias(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export const versionReferencias = () => version;
