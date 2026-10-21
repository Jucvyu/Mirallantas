import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { origen } from '../middleware/auth.js';
import * as eventos from '../models/eventos.model.js';
import * as recuperacion from '../models/recuperacion.model.js';
import * as usuariosModel from '../models/usuarios.model.js';
import { huella } from '../utils/cifrado.js';
import { enviarCorreo } from '../utils/correo.js';
import { cifrarPassword } from '../utils/contrasenas.js';

/**
 * "¿Olvidaste tu contraseña?" con un enlace de un solo uso:
 *
 *   1. solicitar    el usuario escribe su correo. La respuesta es SIEMPRE la
 *                   misma (no revela si el correo está registrado). Si la
 *                   cuenta existe y está activa, se le envía un enlace con
 *                   un token aleatorio de 256 bits que vence en 30 minutos.
 *   2. validar      el frontend revisa el enlace antes de mostrar el
 *                   formulario de la contraseña nueva.
 *   3. restablecer  con el token vigente se guarda la contraseña nueva, el
 *                   enlace queda usado y se cierran todas las sesiones.
 *
 * El token solo sirve para esto: no inicia sesión ni sirve en otra ruta. Se
 * guarda únicamente su huella (HMAC) y nunca se escribe en los registros.
 * Cada IP puede pedir 5 enlaces; luego espera 15 minutos.
 */

const RESPUESTA_GENERICA = {
  mensaje:
    'Si el correo está registrado, te enviaremos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada y la carpeta de spam.',
};

const ENLACE_INVALIDO = 'El enlace no es válido, ya se usó o venció. Solicita uno nuevo.';

/** Escapa un texto para ponerlo dentro del HTML del correo. */
const escapar = (texto) => String(texto).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Plantilla del correo con el enlace. */
function correoDeRecuperacion(nombre, enlace) {
  const minutos = recuperacion.MINUTOS_VIGENCIA;
  return {
    asunto: 'MiraLlantas · Crea una contraseña nueva',
    texto:
      `Hola, ${nombre}.\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta de MiraLlantas.\n` +
      `Abre este enlace para crear una nueva (vence en ${minutos} minutos y solo se puede usar una vez):\n\n${enlace}\n\n` +
      'Si no fuiste tú, ignora este correo: tu contraseña sigue igual.',
    html: `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:#0b0e13;padding:20px 28px;color:#fbbf24;font-size:20px;font-weight:bold">MiraLlantas</td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 12px;font-size:16px">Hola, ${escapar(nombre)}.</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
            Recibimos una solicitud para cambiar la contraseña de tu cuenta. Pulsa el botón para crear una nueva.
          </p>
          <p style="margin:0 0 24px"><a href="${escapar(enlace)}" style="display:inline-block;background:#fbbf24;color:#0f172a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Crear contraseña nueva</a></p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748b">El enlace vence en ${minutos} minutos y solo se puede usar una vez.</p>
          <p style="margin:0;font-size:12px;color:#64748b">Si no fuiste tú, ignora este correo: tu contraseña sigue igual.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

/** POST /auth/recuperar/solicitar — siempre la misma respuesta. */
export async function solicitar(req, res) {
  const { correo } = req.validado.body;
  const { ip, agente } = origen(req);

  if (!(await recuperacion.contarSolicitudIp(ip))) {
    await eventos.registrar({ tipo: 'recuperacion_limite_ip', gravedad: 'Alerta', ip, agente });
    throw new HttpError(429, `Demasiadas solicitudes. Espera ${recuperacion.MINUTOS_BLOQUEO} minutos e inténtalo de nuevo.`);
  }

  const usuario = await usuariosModel.buscarCuenta({ correo });
  // Sin cuenta, o con la cuenta inactiva: no se envía nada, pero la
  // respuesta es la misma (no se revela qué correos están registrados)
  if (!usuario || !usuariosModel.cuentaHabilitada(usuario)) {
    await eventos.registrar({ tipo: 'recuperacion_sin_cuenta', correo, ip, agente });
    return res.json(RESPUESTA_GENERICA);
  }

  // Token de 256 bits; en la base solo queda su huella
  const token = randomBytes(32).toString('base64url');
  const id = await recuperacion.crear(usuario.id, huella(token));
  // Va en el fragmento (#): el navegador no lo envía al servidor del
  // frontend ni a terceros en el "Referer"
  const enlace = `${config.frontendUrl}/restablecer-contrasena#token=${token}`;

  try {
    const plantilla = correoDeRecuperacion(usuario.nombre, enlace);
    await enviarCorreo({ para: usuario.correo, ...plantilla });
    await eventos.registrar({ tipo: 'recuperacion_solicitada', usuarioId: usuario.id, correo: usuario.correo, ip, agente });
  } catch (error) {
    // El enlace que no llegó se anula. Se registra el motivo técnico (sin el
    // token) y al usuario se le responde igual que siempre.
    await recuperacion.anular(id);
    console.error(`No se pudo enviar el correo de recuperación (usuario ${usuario.id}): ${error.message}`);
    await eventos.registrar({ tipo: 'recuperacion_correo_fallido', gravedad: 'Alta', usuarioId: usuario.id, ip, agente });
  }
  res.json(RESPUESTA_GENERICA);
}

/** POST /auth/recuperar/validar — ¿el enlace sigue sirviendo? */
export async function validar(req, res) {
  const vigente = await recuperacion.buscarVigente(huella(req.validado.body.token));
  if (!vigente) throw new HttpError(410, ENLACE_INVALIDO);
  res.json({ valido: true });
}

/** POST /auth/recuperar/restablecer — guarda la contraseña nueva. */
export async function restablecer(req, res) {
  const { token, password } = req.validado.body;
  const passwordHash = await cifrarPassword(password);

  const usuarioId = await enTransaccion(async (db) => {
    const vigente = await recuperacion.buscarVigente(huella(token), { db, bloquear: true });
    if (!vigente) throw new HttpError(410, ENLACE_INVALIDO);
    await usuariosModel.actualizar(db, vigente.usuario_id, [
      ['password_hash', passwordHash],
      // Si estaba bloqueada por intentos de inicio de sesión, se desbloquea
      ['intentos_fallidos', 0],
      ['bloqueado_hasta', null],
    ]);
    // Cierra las sesiones abiertas (por si alguien más tenía acceso)
    await usuariosModel.subirVersionSesion(vigente.usuario_id, db);
    await recuperacion.marcarUsada(db, vigente.id);
    return vigente.usuario_id;
  });

  await eventos.registrar({ tipo: 'password_recuperada', gravedad: 'Alerta', usuarioId, ...origen(req) });
  res.json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
}
