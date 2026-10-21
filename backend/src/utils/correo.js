import { config } from '../config.js';

/**
 * Envío de correos con Resend (por ahora, solo el enlace para recuperar la
 * contraseña).
 *
 * Usa la API HTTP oficial de Resend (POST https://api.resend.com/emails) con
 * la clave RESEND_API_KEY, que solo vive en el servidor. Sin clave (solo en
 * desarrollo y pruebas) no se envía nada: el correo queda en
 * `bandejaDesarrollo` y se muestra en la consola de la API, para probar el
 * flujo sin una cuenta de Resend.
 */

const URL_RESEND = 'https://api.resend.com/emails';

/** Correos "enviados" sin Resend (desarrollo y pruebas). */
export const bandejaDesarrollo = [];

/** Error de envío. El mensaje es técnico: va a los registros, nunca al usuario. */
export class ErrorCorreo extends Error {}

/**
 * Envía un correo: { para, asunto, texto, html }. Lanza ErrorCorreo si
 * Resend lo rechaza o no responde (10 segundos de espera como máximo).
 */
export async function enviarCorreo({ para, asunto, texto, html }) {
  if (!config.correo.resendApiKey) {
    bandejaDesarrollo.push({ para, asunto, texto });
    if (!config.esPrueba) console.log(`\n[correo de desarrollo] Para: ${para}\n${asunto}\n${texto}\n`);
    return;
  }

  let respuesta;
  try {
    respuesta = await fetch(URL_RESEND, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.correo.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.correo.remitente, to: [para], subject: asunto, text: texto, html }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ErrorCorreo(`Resend no respondió: ${error.name}`);
  }
  if (!respuesta.ok) {
    // Resend explica el motivo (dominio sin verificar, clave inválida…) sin datos del destinatario
    const detalle = await respuesta.json().catch(() => ({}));
    throw new ErrorCorreo(`Resend rechazó el correo (${respuesta.status}): ${detalle.name ?? ''} ${detalle.message ?? ''}`.trim());
  }
}
