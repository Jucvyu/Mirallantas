import { config } from '../config.js';

/**
 * Envío de correos con Brevo (por ahora, solo el código para recuperar la
 * contraseña).
 *
 * Usa la API HTTP de Brevo (POST https://api.brevo.com/v3/smtp/email) con la
 * clave BREVO_API_KEY, que solo vive en el servidor. Va por HTTPS porque
 * Render gratis bloquea los puertos SMTP. No necesita dominio propio: basta
 * con que el correo de CORREO_REMITENTE esté verificado como remitente en
 * Brevo (Senders, domains & IPs → Senders).
 *
 * Sin clave (solo en desarrollo y pruebas) no se envía nada: el correo queda
 * en `bandejaDesarrollo` y el código se muestra en la consola de la API, para
 * probar el flujo sin una cuenta de Brevo.
 */

const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

/** Correos "enviados" sin Brevo (desarrollo y pruebas). */
export const bandejaDesarrollo = [];

/** Error de envío. El mensaje es técnico: va a los registros, nunca al usuario. */
export class ErrorCorreo extends Error {}

/** "MiraLlantas <correo@gmail.com>" → { name: 'MiraLlantas', email: 'correo@gmail.com' } */
function remitente(texto) {
  const partes = texto.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return partes ? { name: partes[1] || 'MiraLlantas', email: partes[2].trim() } : { name: 'MiraLlantas', email: texto.trim() };
}

/**
 * Envía un correo: { para, asunto, texto, html }. Lanza ErrorCorreo si
 * Brevo lo rechaza o no responde (10 segundos de espera como máximo).
 */
export async function enviarCorreo({ para, asunto, texto, html }) {
  if (!config.correo.brevoApiKey) {
    bandejaDesarrollo.push({ para, asunto, texto });
    if (!config.esPrueba) console.log(`\n[correo de desarrollo] Para: ${para}\n${asunto}\n${texto}\n`);
    return;
  }

  let respuesta;
  try {
    respuesta = await fetch(URL_BREVO, {
      method: 'POST',
      headers: { 'api-key': config.correo.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: remitente(config.correo.remitente),
        to: [{ email: para }],
        subject: asunto,
        textContent: texto,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ErrorCorreo(`Brevo no respondió: ${error.name}`);
  }
  if (!respuesta.ok) {
    // Brevo explica el motivo (remitente sin verificar, clave inválida…) sin datos del destinatario
    const detalle = await respuesta.json().catch(() => ({}));
    throw new ErrorCorreo(`Brevo rechazó el correo (${respuesta.status}): ${detalle.code ?? ''} ${detalle.message ?? ''}`.trim());
  }
}
