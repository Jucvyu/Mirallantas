import { io } from 'socket.io-client';

/**
 * Abre una conexión de tiempo real como la del navegador. Resuelve con el
 * socket conectado o rechaza con el motivo (SESION_INVALIDA…).
 */
export function conectarSocket(origen, token) {
  return new Promise((resolver, rechazar) => {
    const socket = io(origen, { path: '/api/socket', auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    socket.once('connect', () => resolver(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      rechazar(error);
    });
  });
}

/** Espera un mensaje del socket (o falla a los `ms`). */
export function esperarMensaje(socket, evento, ms = 5000) {
  return new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error(`No llegó "${evento}"`)), ms);
    socket.once(evento, (datos) => {
      clearTimeout(limite);
      resolver(datos);
    });
  });
}
