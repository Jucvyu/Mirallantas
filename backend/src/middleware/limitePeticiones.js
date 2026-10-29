import { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';
import { HttpError } from '../errores.js';
import * as cubos from '../models/cuboFichas.model.js';
import { idDeSesion } from './auth.js';

/**
 * Límite general de peticiones a la API: un cubo de fichas por usuario
 * ("token bucket", como Amazon API Gateway y Stripe).
 *
 * El cubo empieza lleno (`capacidad` fichas) y se rellena solo a razón de
 * `porMinuto` fichas por minuto, sin pasar de su capacidad. Cada petición
 * gasta una ficha; con el cubo vacío se responde 429 y Retry-After dice en
 * cuántos segundos habrá una ficha nueva. Quien no hace nada conserva el
 * cubo lleno; quien hace una ráfaga la puede gastar entera de una vez.
 *
 * El cubo es del usuario de la sesión (aunque use varias pestañas o
 * dispositivos); sin sesión válida, es de la IP. Se guarda en la base (tabla
 * cubo_fichas), así que se respeta aunque la API se reinicie o corra en
 * varias instancias.
 */

/**
 * Usuario de la sesión, o la IP si no hay token válido (vencido o falso
 * cuenta como anónimo). Las IPv6 se agrupan por su red /56: una sola
 * conexión tiene millones de direcciones y, si no, cada una tendría su
 * propio cubo lleno.
 */
function claveDe(req) {
  const usuario = idDeSesion(req);
  return usuario ? `u:${usuario}` : `ip:${ipKeyGenerator(req.ip)}`;
}

// Los cubos sin uso se borran cada 10 minutos (en segundo plano)
const LIMPIEZA_CADA_MS = 10 * 60 * 1000;
let ultimaLimpieza = 0;

function limpiarDeVezEnCuando() {
  if (Date.now() - ultimaLimpieza < LIMPIEZA_CADA_MS) return;
  ultimaLimpieza = Date.now();
  cubos.borrarInactivos().catch((error) => console.error('No se pudieron borrar los cubos de fichas:', error.message));
}

export async function limitePeticiones(req, res, next) {
  const { capacidad, porMinuto } = config.limiteApi;
  const porSegundo = porMinuto / 60;

  let resultado;
  try {
    resultado = await cubos.consumir(claveDe(req), config.limiteApi);
  } catch (error) {
    // Si la base no responde, no se bloquea a nadie por el límite
    console.error('No se pudo revisar el límite de peticiones:', error.message);
    return next();
  }
  limpiarDeVezEnCuando();

  const { permitida, fichas } = resultado;
  // Cabeceras estándar (borrador IETF RateLimit, versión 8): capacidad y
  // ventana de la política; fichas que quedan y segundos hasta llenarse
  res.set('RateLimit-Policy', `"cubo";q=${capacidad};w=${Math.round(capacidad / porSegundo)}`);
  res.set('RateLimit', `"cubo";r=${Math.floor(fichas)};t=${Math.ceil((capacidad - fichas) / porSegundo)}`);

  if (!permitida) {
    const espera = Math.max(1, Math.ceil((1 - fichas) / porSegundo));
    res.set('Retry-After', String(espera));
    throw new HttpError(
      429,
      'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
      undefined,
      'LIMITE_PETICIONES',
    ).con({ reintentarEn: espera });
  }
  next();
}
