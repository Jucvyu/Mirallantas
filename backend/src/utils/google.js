import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../errores.js';

/**
 * "Iniciar sesión con Google".
 *
 * El navegador recibe de Google un token (JWT firmado por Google) y lo envía
 * a la API. Aquí se comprueba la firma con las llaves públicas de Google, que
 * el token sea para NUESTRA aplicación (GOOGLE_CLIENT_ID) y que no haya
 * vencido. No hace falta ninguna librería extra: jsonwebtoken verifica y Node
 * convierte las llaves (formato JWK) en llaves públicas.
 */

const URL_LLAVES = 'https://www.googleapis.com/oauth2/v3/certs';
const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

// Las llaves de Google cambian cada pocos días: se guardan el tiempo que
// Google indica en Cache-Control y luego se vuelven a pedir.
let llaves = new Map();
let vencenEn = 0;

async function llavesDeGoogle() {
  if (Date.now() < vencenEn) return llaves;
  const respuesta = await fetch(URL_LLAVES, { signal: AbortSignal.timeout(5000) });
  if (!respuesta.ok) throw new Error(`Google respondió ${respuesta.status} al pedir sus llaves`);
  const { keys } = await respuesta.json();
  llaves = new Map(keys.map((jwk) => [jwk.kid, createPublicKey({ key: jwk, format: 'jwk' })]));
  const maxAge = Number(respuesta.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  vencenEn = Date.now() + maxAge * 1000;
  return llaves;
}

/** ¿Está configurado el inicio con Google? */
export const googleDisponible = () => Boolean(config.googleClientId);

/**
 * Comprueba el token de Google y devuelve el correo verificado de la cuenta.
 * Lanza 401 si el token no es válido.
 */
export async function correoDeGoogle(credencial) {
  const invalido = () => new HttpError(401, 'No pudimos verificar tu cuenta de Google. Inténtalo de nuevo.');

  const cabecera = jwt.decode(credencial, { complete: true })?.header;
  if (!cabecera?.kid) throw invalido();
  let llave = (await llavesDeGoogle()).get(cabecera.kid);
  if (!llave) {
    // Google pudo rotar sus llaves antes de tiempo: se piden de nuevo una vez
    vencenEn = 0;
    llave = (await llavesDeGoogle()).get(cabecera.kid);
  }
  if (!llave) throw invalido();

  let datos;
  try {
    datos = jwt.verify(credencial, llave, { algorithms: ['RS256'], audience: config.googleClientId, issuer: EMISORES });
  } catch {
    throw invalido();
  }
  // Solo se confía en correos que Google ya verificó
  if (!datos.email || datos.email_verified !== true) {
    throw new HttpError(401, 'Tu cuenta de Google no tiene un correo verificado.');
  }
  return datos.email.toLowerCase();
}
