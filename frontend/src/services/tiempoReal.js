// =========================================================================
// Actualización en tiempo real.
//
// Mientras haya sesión, se mantiene abierta una conexión a /api/eventos
// (Server-Sent Events). Cuando la API avisa que algo cambió, se dispara el
// evento EVENTO_CAMBIO en la ventana y cada pantalla abierta vuelve a pedir
// sus datos (ver hooks/useAlCambiar.js). Si la conexión se corta, se
// reintenta sola, cada vez con más espera.
// =========================================================================

import { URL_API } from '../config';
import { leerToken } from './http';

/** Evento de la ventana: { detail: { recursos: ['cotizaciones', …] } }. */
export const EVENTO_CAMBIO = 'mirallantas:cambio';

let controlador = null;

/** Lee los mensajes "event: cambio" del flujo y los avisa en la ventana. */
async function escuchar(respuesta) {
  const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) return;
    resto += value;
    const mensajes = resto.split('\n\n');
    resto = mensajes.pop();
    for (const mensaje of mensajes) {
      const lineas = mensaje.split('\n');
      if (!lineas.includes('event: cambio')) continue;
      const datos = lineas.find((l) => l.startsWith('data: '));
      try {
        const { recursos } = JSON.parse(datos.slice(6));
        window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: { recursos } }));
      } catch {
        // Mensaje incompleto: se ignora
      }
    }
  }
}

/** Abre la conexión (si no está abierta) y la mantiene mientras haya sesión. */
export function conectarTiempoReal() {
  if (controlador || !URL_API || typeof TextDecoderStream === 'undefined') return;
  controlador = new AbortController();
  const { signal } = controlador;

  const bucle = async () => {
    let espera = 2000;
    while (!signal.aborted && leerToken()) {
      try {
        const respuesta = await fetch(`${URL_API}/eventos`, {
          headers: { Authorization: `Bearer ${leerToken()}` },
          signal,
        });
        // Sin sesión válida no se insiste: el resto de la app ya la maneja
        if (respuesta.status === 401 || respuesta.status === 403) break;
        if (respuesta.ok) {
          espera = 2000;
          // Al reconectar se recarga todo: pudo cambiar algo mientras tanto
          window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: { recursos: ['*'] } }));
          await escuchar(respuesta);
        }
      } catch {
        // Sin conexión o se cerró la sesión: se reintenta (o se sale si se abortó)
      }
      if (signal.aborted) break;
      await new Promise((listo) => setTimeout(listo, espera));
      espera = Math.min(espera * 2, 30_000);
    }
    if (controlador?.signal === signal) controlador = null;
  };
  bucle();
}

/** Cierra la conexión (al cerrar sesión). */
export function desconectarTiempoReal() {
  controlador?.abort();
  controlador = null;
}
