// =========================================================================
// Actualización en tiempo real (Socket.IO).
//
// Mientras haya sesión se mantiene abierta una conexión a la API
// (/api/socket: WebSocket, o sondeo HTTP si la red no lo deja). Llegan dos
// tipos de mensaje:
//
//   'cambio'        { recursos } — algo cambió: se dispara EVENTO_CAMBIO en
//                   la ventana y cada pantalla recarga SOLO si lo que
//                   muestra depende de esos recursos (ver dependencias.js y
//                   hooks/useAlCambiar.js).
//   'notificacion'  un aviso nuevo para este usuario: se dispara
//                   EVENTO_NOTIFICACION y la campana lo muestra al instante.
//
// Si la conexión se corta, Socket.IO reintenta solo, cada vez con más
// espera. Al RE-conectar se recarga todo: pudo cambiar algo mientras tanto
// (la primera conexión no, porque las pantallas acaban de cargar).
// =========================================================================

import { io } from 'socket.io-client';
import { URL_API } from '../config';
import { leerToken } from './http';

export { afecta } from './dependencias';

/** Evento de la ventana: { detail: { recursos: ['cotizaciones', …] } }. */
export const EVENTO_CAMBIO = 'mirallantas:cambio';
/** Evento de la ventana: { detail: { titulo, mensaje, tipo, enlace } }. */
export const EVENTO_NOTIFICACION = 'mirallantas:notificacion';

let socket = null;

const avisar = (nombre, detail) => window.dispatchEvent(new CustomEvent(nombre, { detail }));

/** Abre la conexión (si no está abierta) y la mantiene mientras haya sesión. */
export function conectarTiempoReal() {
  if (socket || !URL_API || !leerToken()) return;
  // URL_API termina en /api: Socket.IO va al mismo servidor, en /api/socket
  const origen = new URL(URL_API, window.location.origin);
  socket = io(origen.origin, {
    path: `${origen.pathname.replace(/\/$/, '')}/socket`,
    // El token se lee en cada intento: si cambió la sesión, va el nuevo
    auth: (cb) => cb({ token: leerToken() }),
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
  });

  let conectadoAntes = false;
  socket.on('connect', () => {
    if (conectadoAntes) avisar(EVENTO_CAMBIO, { recursos: ['*'] });
    conectadoAntes = true;
  });
  socket.on('cambio', (datos) => avisar(EVENTO_CAMBIO, { recursos: datos?.recursos ?? ['*'] }));
  socket.on('notificacion', (aviso) => avisar(EVENTO_NOTIFICACION, aviso));
  socket.on('connect_error', (error) => {
    // Sin sesión válida no se insiste: el resto de la app ya la maneja
    if (error?.message === 'SESION_INVALIDA' || !leerToken()) desconectarTiempoReal();
  });
  socket.on('disconnect', (motivo) => {
    // La API la cortó (se cerró la sesión): solo se vuelve a intentar si aún hay token
    if (motivo === 'io server disconnect' && leerToken()) socket?.connect();
  });
}

/** ¿Hay conexión de tiempo real ahora? (si no, la campana revisa sola de vez en cuando) */
export const tiempoRealConectado = () => Boolean(socket?.connected);

/** Cierra la conexión (al cerrar sesión). */
export function desconectarTiempoReal() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
