import nodemailer from 'nodemailer';
import { config } from '../config.js';

/**
 * Envío de correos (por ahora, el código para recuperar la contraseña).
 *
 * Con SMTP configurado (variables SMTP_* del .env) el correo sale de verdad.
 * Sin SMTP (solo desarrollo y pruebas) no se envía nada: el correo queda en
 * `bandejaDesarrollo` y el código se muestra en la consola de la API, para
 * poder probar el flujo sin una cuenta de correo.
 */

const hayServidor = Boolean(config.smtp.host);

const transporte = hayServidor
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.puerto,
      // 465 usa TLS desde el inicio; 587 empieza en claro y sube a TLS (STARTTLS)
      secure: config.smtp.puerto === 465,
      requireTLS: config.smtp.puerto !== 465,
      auth: { user: config.smtp.usuario, pass: config.smtp.password },
    })
  : null;

/** Correos "enviados" sin SMTP (desarrollo y pruebas). */
export const bandejaDesarrollo = [];

/** Envía un correo: { para, asunto, texto, html }. */
export async function enviarCorreo({ para, asunto, texto, html }) {
  if (!transporte) {
    bandejaDesarrollo.push({ para, asunto, texto });
    if (!config.esPrueba) console.log(`\n[correo de desarrollo] Para: ${para}\n${asunto}\n${texto}\n`);
    return;
  }
  await transporte.sendMail({ from: config.smtp.remitente, to: para, subject: asunto, text: texto, html });
}
