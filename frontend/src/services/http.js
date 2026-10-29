// =========================================================================
// Cliente HTTP: la única puerta de entrada del frontend a la API.
//
// Solo lo usan los servicios (src/services/*.service.js). Las pantallas
// nunca llaman a la API directamente: le piden los datos a un servicio.
// Así, si mañana cambia la dirección del servidor o la forma de enviar el
// token, se cambia en un solo lugar.
// =========================================================================

// Dirección de la API: VITE_API_URL (ver src/config.js y frontend/.env)
import { URL_API } from '../config';

/** Nombre con el que se guarda el token en el navegador. */
const CLAVE_TOKEN = 'mirallantas-token';

/** Evento que se dispara cuando el servidor rechaza la sesión (401). */
export const EVENTO_SESION_EXPIRADA = 'mirallantas:sesion-expirada';

/** Evento que se dispara cuando desactivan la cuenta con la sesión abierta. */
export const EVENTO_CUENTA_INACTIVA = 'mirallantas:cuenta-inactiva';

/** Evento que se dispara cuando el servidor no responde (caído o reiniciándose). */
export const EVENTO_SERVIDOR_CAIDO = 'mirallantas:servidor-caido';

/** Respuestas del proveedor cuando la API está caída o arrancando. */
const ESTADOS_SERVIDOR_CAIDO = [502, 503, 504];

/**
 * ¿Falló el servidor antes de que la pantalla de aviso estuviera lista? (p. ej.
 * al cargar las listas iniciales). La pantalla lo lee al aparecer.
 */
export let servidorCaidoAlIniciar = false;

/** Avisa a la aplicación que el servidor no responde. */
function avisarServidorCaido() {
  servidorCaidoAlIniciar = true;
  window.dispatchEvent(new Event(EVENTO_SERVIDOR_CAIDO));
}

/** Mensaje para cuando una petición no llega al servidor: sin internet o servidor caído. */
function errorSinConexion() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ErrorApi(0, 'No tienes conexión a internet. Revisa tu red e inténtalo de nuevo.');
  }
  avisarServidorCaido();
  return new ErrorApi(0, 'No pudimos comunicarnos con el servidor. Inténtalo de nuevo en unos segundos.');
}

/**
 * ¿El servidor responde? Lo usa la pantalla de "servidor no disponible"
 * para saber cuándo volvió.
 */
export async function servidorDisponible() {
  try {
    const respuesta = await fetch(`${URL_API}/salud`, { cache: 'no-store' });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** Código con el que la API avisa que la cuenta está inactiva. */
export const CODIGO_CUENTA_INACTIVA = 'CUENTA_INACTIVA';

// ---- Token de sesión ------------------------------------------------------
// localStorage puede fallar (modo privado, almacenamiento bloqueado), por
// eso cada acceso va dentro de try/catch.

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento, la sesión dura lo que dure la pestaña
  }
}

export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Nada que borrar
  }
}

// ---- Errores --------------------------------------------------------------

/**
 * Error que devuelve la API. `message` ya viene en español y listo para
 * mostrar al usuario; `detalles` trae los errores por campo cuando el
 * servidor rechaza un formulario (422).
 */
export class ErrorApi extends Error {
  constructor(estado, mensaje, detalles = [], datos = null) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
    // Respuesta completa, por si trae datos extra (p. ej. intentos restantes)
    this.datos = datos;
  }
}

// ---- Peticiones -----------------------------------------------------------

/**
 * Hace una petición a la API y devuelve el cuerpo de la respuesta.
 *
 *   await api('/clientes')                                  // GET
 *   await api('/clientes', { metodo: 'POST', cuerpo: {…} }) // POST
 *   await api('/x', { cabecerasExtra: { 'Idempotency-Key': … } })
 *
 * Si algo sale mal lanza un `ErrorApi` con un mensaje para el usuario.
 */
export async function api(ruta, { metodo = 'GET', cuerpo, cabecerasExtra = {} } = {}) {
  const token = leerToken();
  const cabeceras = { ...cabecerasExtra };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  // En producción, sin VITE_API_URL no hay a dónde llamar: se avisa claro
  if (!URL_API) throw new ErrorApi(0, 'La aplicación no tiene configurada la dirección de la API (VITE_API_URL).');
  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    // fetch solo falla así cuando no hay internet o el servidor no responde
    throw errorSinConexion();
  }

  // Servidor caído o arrancando (el proveedor responde 502/503/504)
  if (ESTADOS_SERVIDOR_CAIDO.includes(respuesta.status)) avisarServidorCaido();

  // 204 = "sin contenido" (por ejemplo, al eliminar)
  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // Sesión vencida o inválida: se avisa para volver al login
    // (salvo al cerrar sesión: ese token ya se iba a descartar)
    if (respuesta.status === 401 && token && ruta !== '/auth/salir') {
      borrarToken();
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    // Cuenta desactivada mientras estaba en sesión: se sale y se le explica
    if (datos?.codigo === CODIGO_CUENTA_INACTIVA && token) {
      borrarToken();
      window.dispatchEvent(new Event(EVENTO_CUENTA_INACTIVA));
    }
    throw new ErrorApi(
      respuesta.status,
      datos?.error ?? 'Ocurrió un error inesperado. Intenta de nuevo.',
      datos?.detalles ?? [],
      datos,
    );
  }
  return datos;
}

/**
 * Descarga un archivo de la API (p. ej. un PDF) y lo guarda en el equipo
 * con `nombre`. Si la API responde con error, lanza un `ErrorApi` con su
 * mensaje (así la pantalla lo muestra igual que cualquier otro error).
 */
export async function descargarArchivo(ruta, nombre) {
  const token = leerToken();
  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw errorSinConexion();
  }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new ErrorApi(respuesta.status, datos?.error ?? 'No se pudo generar el documento.', [], datos);
  }
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/**
 * Trae TODAS las filas de un listado paginado.
 *
 * La API devuelve máximo 100 filas por página; esta función pide página por
 * página hasta tenerlas todas. Las tablas del panel filtran y paginan en el
 * navegador, así que necesitan la lista completa.
 */
export async function traerTodo(ruta) {
  const separador = ruta.includes('?') ? '&' : '?';
  const filas = [];
  for (let pagina = 1; ; pagina += 1) {
    const respuesta = await api(`${ruta}${separador}porPagina=100&pagina=${pagina}`);
    // Algunas rutas (roles, permisos) no paginan: devuelven todo de una vez
    if (respuesta.total === undefined) return respuesta.datos;
    filas.push(...respuesta.datos);
    if (filas.length >= respuesta.total || respuesta.datos.length === 0) return filas;
  }
}

/**
 * Clave de idempotencia para un pago o una cotización: se genera una al
 * abrir el formulario y se reutiliza si el envío se repite (doble clic,
 * reintento). Así la API nunca registra el mismo pago dos veces.
 */
export const nuevaClaveIdempotencia = () => crypto.randomUUID();

/** Cabecera que lleva la clave de idempotencia. */
export const conClave = (clave) => (clave ? { 'Idempotency-Key': clave } : {});
