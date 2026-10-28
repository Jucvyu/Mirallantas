/**
 * Actualización en tiempo real (Server-Sent Events).
 *
 * Cada pantalla abierta mantiene una conexión a GET /api/eventos. Cuando
 * una petición cambia datos (POST, PUT, PATCH o DELETE que salió bien), se
 * avisa a todas las conexiones qué recursos cambiaron y cada pantalla vuelve
 * a pedir sus datos. El aviso no lleva datos: solo el nombre del recurso,
 * así nadie recibe información que no le toca.
 */

/** Conexiones abiertas. */
const conexiones = new Set();

/** Cada cuánto se manda un latido para que los proxies no cierren la conexión. */
const LATIDO_MS = 25_000;
/** Los cambios que llegan juntos se avisan en un solo mensaje. */
const AGRUPAR_MS = 150;

let pendientes = new Set();
let temporizador = null;

/** GET /api/eventos — deja abierta la conexión y la registra. */
export function suscribir(req, res) {
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

  const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);
  conexiones.add(res);
  req.on('close', () => {
    clearInterval(latido);
    conexiones.delete(res);
  });
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
}
