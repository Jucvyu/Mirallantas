/**
 * Actualización en tiempo real con Socket.IO (WebSocket, y si la red no lo
 * deja, sondeo HTTP).
 *
 * Cada pantalla abierta se conecta con su token de sesión. Hay dos tipos de
 * mensaje:
 *
 *   'cambio'        { recursos: ['cotizaciones', …] } — una petición cambió
 *                   datos (POST, PUT, PATCH o DELETE que salió bien) y cada
 *                   pantalla vuelve a pedir los suyos. No lleva datos.
 *   'notificacion'  { titulo, mensaje, tipo, enlace } — un aviso nuevo, solo
 *                   para quien le toca: el cliente dueño (sala `cliente:id`)
 *                   o el personal con el módulo del aviso (sala `modulo:X`).
 *                   La campana lo muestra al instante, sin esperar la
 *                   revisión de cada minuto.
 */
import { Server } from 'socket.io';
import { config } from '../config.js';
import { buscarCuenta, cuentaHabilitada, sesionVigente } from '../models/usuarios.model.js';
import { leerToken } from '../middleware/auth.js';

/** Pestañas abiertas a la vez por usuario (una conexión por pestaña). */
export const MAXIMO_POR_USUARIO = 10;

/** Cada cuánto se revisa que la sesión de cada conexión siga valiendo. */
const REVISAR_SESION_MS = 25_000;
/**
 * Los cambios que llegan juntos se avisan en un solo mensaje: una ráfaga de
 * 60 cambios produce unos pocos avisos, no 60 recargas en cada pestaña (ver
 * test/saturacion.test.js).
 */
const AGRUPAR_MS = 300;
/**
 * Los avisos se crean dentro de una transacción: se emiten un instante
 * después para que, cuando la campana los pida, ya estén guardados.
 */
const ESPERA_AVISO_MS = 300;

let io = null;
/** Conexiones abiertas de cada usuario: id → Set de sockets. */
const porUsuario = new Map();

let pendientes = new Set();
let temporizador = null;

/** Conecta Socket.IO al servidor HTTP de la API (en /api/socket). */
export function adjuntarTiempoReal(servidor) {
  io = new Server(servidor, {
    path: '/api/socket',
    cors: { origin: config.corsOrigenes, credentials: false },
    serveClient: false,
  });

  // Solo entra quien trae un token de sesión válido de una cuenta activa
  io.use(async (socket, next) => {
    try {
      const carga = leerToken(String(socket.handshake.auth?.token ?? ''), 'sesion');
      const usuario = await buscarCuenta({ id: Number(carga.sub) });
      if (!usuario || !cuentaHabilitada(usuario) || carga.ver !== usuario.version_sesion) {
        return next(new Error('SESION_INVALIDA'));
      }
      const suyas = porUsuario.get(usuario.id) ?? new Set();
      if (suyas.size >= MAXIMO_POR_USUARIO) return next(new Error('DEMASIADAS_PESTANAS'));
      socket.data = { usuarioId: usuario.id, version: carga.ver, clienteId: usuario.cliente_id ?? null, permisos: usuario.permisos ?? [] };
      next();
    } catch {
      next(new Error('SESION_INVALIDA'));
    }
  });

  io.on('connection', (socket) => {
    const { usuarioId, version, clienteId, permisos } = socket.data;
    const suyas = porUsuario.get(usuarioId) ?? new Set();
    suyas.add(socket);
    porUsuario.set(usuarioId, suyas);
    socket.join(`usuario:${usuarioId}`);
    if (clienteId) socket.join(`cliente:${clienteId}`);
    else for (const modulo of permisos) socket.join(`modulo:${modulo}`);

    // Si cerraron la sesión, abrieron otra o desactivaron la cuenta, se corta
    const revision = setInterval(async () => {
      try {
        if (!(await sesionVigente(usuarioId, version))) socket.disconnect(true);
      } catch {
        // Si la base no responde, se revisa en la próxima vuelta
      }
    }, REVISAR_SESION_MS);

    socket.on('disconnect', () => {
      clearInterval(revision);
      suyas.delete(socket);
      if (!suyas.size) porUsuario.delete(usuarioId);
    });
  });
  return io;
}

/** Corta al instante las conexiones de un usuario (al cerrar su sesión). */
export function cerrarConexionesDe(usuario) {
  for (const socket of porUsuario.get(usuario) ?? []) socket.disconnect(true);
}

/** Avisa que cambió un recurso (p. ej. 'cotizaciones'). */
export function avisarCambio(recurso) {
  pendientes.add(recurso);
  if (temporizador) return;
  temporizador = setTimeout(() => {
    const recursos = [...pendientes];
    pendientes = new Set();
    temporizador = null;
    io?.emit('cambio', { recursos });
  }, AGRUPAR_MS);
}

/**
 * Empuja un aviso nuevo a quien le toca:
 *   avisarNotificacion({ clienteId: 4 }, aviso)       el cliente del portal
 *   avisarNotificacion({ modulo: 'Reencauche' }, aviso) el personal con ese módulo
 */
export function avisarNotificacion({ clienteId, modulo }, { titulo, mensaje, tipo = 'info', enlace = null }) {
  if (!io) return;
  const sala = clienteId ? `cliente:${clienteId}` : `modulo:${modulo}`;
  setTimeout(() => io?.to(sala).emit('notificacion', { titulo, mensaje, tipo, enlace }), ESPERA_AVISO_MS).unref?.();
}

/** Recurso de una ruta: /api/cotizaciones/PED-1/pago → 'cotizaciones'. */
export function recursoDe(ruta) {
  return ruta.split('?')[0].split('/')[2] ?? '';
}

/** Rutas que no cambian datos que se vean en pantalla (sesión, avisos leídos). */
const SIN_AVISO = [/^\/api\/auth\/(login|google|2fa|salir|recuperar|captcha)/, /^\/api\/(portal\/)?notificaciones/];

/** ¿Esta petición debe avisar un cambio? */
export function debeAvisar(req, res) {
  if (req.method === 'GET' || res.statusCode >= 400) return false;
  return !SIN_AVISO.some((patron) => patron.test(req.originalUrl));
}

/** Cierra todas las conexiones (al apagar la API, para no quedar esperándolas). */
export function cerrarConexiones() {
  io?.disconnectSockets(true);
  io?.close();
  io = null;
  porUsuario.clear();
}
