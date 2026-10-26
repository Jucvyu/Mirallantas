import { config } from '../config.js';
import { HttpError } from '../errores.js';

/**
 * Captcha del inicio de sesión (Cloudflare Turnstile).
 *
 * El navegador resuelve la prueba y recibe un token de un solo uso; aquí se
 * le pregunta a Cloudflare si ese token es válido. Sin el token, o si
 * Cloudflare no lo aprueba, no se deja iniciar sesión.
 *
 * Sin TURNSTILE_SECRET_KEY (desarrollo y pruebas) no se exige.
 */

const VERIFICAR_EN = process.env.TURNSTILE_VERIFY_URL ?? 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const captchaActivo = () => Boolean(config.turnstileSecret);

/** Lanza un error si el captcha no se resolvió o no se superó. */
export async function exigirCaptcha(token, ip) {
  if (!captchaActivo()) return;
  if (!token) throw new HttpError(400, 'Completa la verificación de seguridad (captcha) para continuar.');

  let resultado;
  try {
    const respuesta = await fetch(VERIFICAR_EN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: config.turnstileSecret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    resultado = await respuesta.json();
  } catch {
    // Si no se puede comprobar, no se deja pasar
    throw new HttpError(503, 'No pudimos comprobar la verificación de seguridad. Inténtalo de nuevo.');
  }
  if (!resultado?.success) {
    throw new HttpError(400, 'No superaste la verificación de seguridad. Vuelve a intentarlo.');
  }
}
