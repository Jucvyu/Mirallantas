// =========================================================================
// Actualización en tiempo real (Socket.IO).
//
// Mientras haya sesión se mantiene abierta una conexión a la API
// (/api/socket: WebSocket, o sondeo HTTP si la red no lo deja). Llegan dos
// tipos de mensaje:
//
//   'cambio'        algo cambió: se dispara EVENTO_CAMBIO en la ventana y
//                   cada pantalla abierta vuelve a pedir sus datos (ver
//                   hooks/useAlCambiar.js).
//   'notificacion'  un aviso nuevo para este usuario: se dispara
//                   EVENTO_NOTIFICACION y la campana lo muestra al instante.
//
// Si la conexión se corta, Socket.IO reintenta solo, cada vez con más espera.
// =========================================================================

import { io } from 'socket.io-client';
import { URL_API } from '../config';
import { leerToken } from './http';

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
  });

  // Al (re)conectar se recarga todo: pudo cambiar algo mientras tanto
  socket.on('connect', () => avisar(EVENTO_CAMBIO, { recursos: ['*'] }));
  socket.on('cambio', (datos) => avisar(EVENTO_CAMBIO, datos));
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

/** Cierra la conexión (al cerrar sesión). */
export function desconectarTiempoReal() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
