/**
 * Actualización en tiempo real (Server-Sent Events).
 *
 * Cada pantalla abierta mantiene una conexión a GET /api/eventos. Cuando
 * una petición cambia datos (POST, PUT, PATCH o DELETE que salió bien), se
 * avisa a todas las conexiones qué recursos cambiaron y cada pantalla vuelve
 * a pedir sus datos. El aviso no lleva datos: solo el nombre del recurso,
 * así nadie recibe información que no le toca.
 */
import { HttpError } from '../errores.js';
import { sesionVigente } from '../models/usuarios.model.js';

/** Conexiones abiertas. */
const conexiones = new Set();
/** Conexiones abiertas de cada usuario: id → Set de respuestas. */
const porUsuario = new Map();
/** Pestañas abiertas a la vez por usuario (una conexión por pestaña). */
export const MAXIMO_POR_USUARIO = 10;

/** Cada cuánto se manda un latido para que los proxies no cierren la conexión. */
const LATIDO_MS = 25_000;
/** Los cambios que llegan juntos se avisan en un solo mensaje. */
const AGRUPAR_MS = 150;

let pendientes = new Set();
let temporizador = null;

/** GET /api/eventos — deja abierta la conexión y la registra. */
export function suscribir(req, res) {
  // Máximo MAXIMO_POR_USUARIO conexiones a la vez por usuario: así nadie
  // agota el servidor abriendo miles. La pestaña rechazada lo reintenta
  // sola más tarde (con espera creciente).
  const usuario = req.usuario.id;
  const suyas = porUsuario.get(usuario) ?? new Set();
  if (suyas.size >= MAXIMO_POR_USUARIO) {
    throw new HttpError(429, 'Tienes demasiadas pestañas abiertas. Cierra alguna para recibir los cambios al instante.');
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    // Sin esto, algunos proxies acumulan los mensajes en vez de enviarlos
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  // El navegador reintenta a los 3 s si se corta
  res.write('retry: 3000\n\n');

  // En cada latido se revisa que la sesión siga valiendo: si la cerraron,
  // abrieron otra en otro dispositivo, cambió la contraseña o desactivaron
  // la cuenta, la conexión se corta (y al reconectar recibe 401).
  const version = req.versionSesion;
  const latido = setInterval(async () => {
    try {
      if (!(await sesionVigente(usuario, version))) return res.end();
    } catch {
      // Si la base no responde, se revisa en el próximo latido
    }
    res.write(': latido\n\n');
  }, LATIDO_MS);
  conexiones.add(res);
  suyas.add(res);
  porUsuario.set(usuario, suyas);

  req.on('close', () => {
    clearInterval(latido);
    conexiones.delete(res);
    suyas.delete(res);
    if (!suyas.size) porUsuario.delete(usuario);
  });
}

/** Corta al instante las conexiones de un usuario (al cerrar su sesión). */
export function cerrarConexionesDe(usuario) {
  for (const res of porUsuario.get(usuario) ?? []) res.end();
}

/** Avisa que cambió un recurso (p. ej. 'cotizaciones'). */
export function avisarCambio(recurso) {
  pendientes.add(recurso);
  if (temporizador) return;
  temporizador = setTimeout(() => {
    const mensaje = `event: cambio\ndata: ${JSON.stringify({ recursos: [...pendientes] })}\n\n`;
    pendientes = new Set();
    temporizador = null;
    for (const res of conexiones) res.write(mensaje);
  }, AGRUPAR_MS);
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
  for (const res of conexiones) res.end();
  conexiones.clear();
  porUsuario.clear();
}
