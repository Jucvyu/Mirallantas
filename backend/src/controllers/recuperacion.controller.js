import { randomInt } from 'node:crypto';
import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { errorCuentaInactiva, origen } from '../middleware/auth.js';
import * as eventos from '../models/eventos.model.js';
import * as recuperacion from '../models/recuperacion.model.js';
import * as usuariosModel from '../models/usuarios.model.js';
import { coincideHuella, huella } from '../utils/cifrado.js';
import { enviarCorreo, ErrorCorreo } from '../utils/correo.js';
import { cifrarPassword } from '../utils/contrasenas.js';
import { plantillaRecuperacion } from '../utils/plantillaRecuperacion.js';

/**
 * "¿Olvidaste tu contraseña?" en tres pasos:
 *
 *   1. solicitar  el usuario escribe su correo. Si no existe, se le avisa y
 *                 pierde un intento (5 por IP; al agotarlos espera 2 min).
 *                 Si existe, se le envía un código de 6 dígitos.
 *   2. verificar  escribe el código. Tiene 3 intentos; si los pierde, el
 *                 código se anula y la IP espera 2 minutos.
 *   3. cambiar    con el código ya verificado, escribe la contraseña nueva.
 *
 * Los intentos se cuentan en el servidor (por IP), no en el navegador:
 * recargar la página no los reinicia.
 */

/** "juan.perez@gmail.com" → "ju*******@gmail.com" */
function enmascarar(correo) {
  const [nombre, dominio] = correo.split('@');
  return `${nombre.slice(0, 2)}${'*'.repeat(Math.max(nombre.length - 2, 3))}@${dominio}`;
}

/** Error que además informa los intentos y el bloqueo de la IP. */
const errorConEstado = (estado, mensaje, estadoIp) => new HttpError(estado, mensaje).con(estadoIp);

/** Rechaza la petición si la IP está esperando sus 2 minutos. */
async function exigirIpLibre(ip) {
  const estado = await recuperacion.estadoIp(ip);
  if (estado.bloqueadoHasta) {
    throw errorConEstado(
      429,
      `Demasiados intentos. Espera ${recuperacion.MINUTOS_BLOQUEO} minutos para volver a intentarlo.`,
      estado,
    );
  }
  return estado;
}

/** GET /auth/recuperar/estado — intentos que le quedan a esta IP. */
export async function estado(req, res) {
  res.json(await recuperacion.estadoIp(req.ip));
}

/** POST /auth/recuperar/solicitar — paso 1: buscar el correo y enviar el código. */
export async function solicitar(req, res) {
  const { correo } = req.validado.body;
  const { ip, agente } = origen(req);
  await exigirIpLibre(ip);

  const usuario = await usuariosModel.buscarCuenta({ correo });
  // Una cuenta inactiva no recupera la contraseña: primero hay que reactivarla
  if (usuario && !usuariosModel.cuentaHabilitada(usuario)) throw errorCuentaInactiva();
  if (!usuario) {
    const estadoIp = await recuperacion.descontarIntentoIp(ip);
    await eventos.registrar({ tipo: 'recuperacion_correo_inexistente', gravedad: 'Alerta', correo, ip, agente });
    const mensaje = estadoIp.bloqueadoHasta
      ? `No hay ninguna cuenta con ese correo. Agotaste los intentos: espera ${recuperacion.MINUTOS_BLOQUEO} minutos.`
      : `No hay ninguna cuenta con ese correo. Te quedan ${estadoIp.intentosRestantes} intento(s).`;
    throw errorConEstado(estadoIp.bloqueadoHasta ? 429 : 404, mensaje, estadoIp);
  }

  // Encontró su cuenta: la IP recupera sus intentos
  await recuperacion.reiniciarIp(ip);
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const solicitud = await recuperacion.crear(usuario.id, huella(codigo));

  try {
    await enviarCorreo({
      para: usuario.correo,
      ...plantillaRecuperacion({ nombre: usuario.nombre, codigo, minutos: recuperacion.MINUTOS_VIGENCIA }),
    });
  } catch (error) {
    if (!(error instanceof ErrorCorreo)) throw error;
    // El motivo técnico queda en los registros; al usuario, un mensaje claro
    console.error(`No se pudo enviar el código de recuperación (usuario ${usuario.id}): ${error.message}`);
    throw new HttpError(503, 'No pudimos enviar el código en este momento. Intenta de nuevo en unos minutos.');
  }
  await eventos.registrar({ tipo: 'recuperacion_solicitada', usuarioId: usuario.id, correo: usuario.correo, ip, agente });

  res.json({
    solicitud: solicitud.id,
    correo: enmascarar(usuario.correo),
    intentosCodigo: recuperacion.INTENTOS_CODIGO,
    venceEn: solicitud.expira_en,
  });
}

/** POST /auth/recuperar/verificar — paso 2: revisar el código. */
export async function verificar(req, res) {
  const { solicitud: id, codigo } = req.validado.body;
  const { ip, agente } = origen(req);
  await exigirIpLibre(ip);

  const solicitud = await recuperacion.buscarVigente(id);
  if (!solicitud) throw new HttpError(410, 'El código venció o ya no es válido. Solicita uno nuevo.');

  if (!coincideHuella(codigo, solicitud.codigo_hash)) {
    const quedan = await recuperacion.descontarIntentoCodigo(id);
    await eventos.registrar({
      tipo: 'recuperacion_codigo_fallido',
      gravedad: quedan === 0 ? 'Alta' : 'Alerta',
      usuarioId: solicitud.usuario_id,
      ip,
      agente,
    });
    if (quedan === 0) {
      const estadoIp = await recuperacion.bloquearIp(ip);
      throw errorConEstado(
        429,
        `Código incorrecto. Agotaste los intentos: espera ${recuperacion.MINUTOS_BLOQUEO} minutos y solicita un código nuevo.`,
        { ...estadoIp, intentosCodigo: 0 },
      );
    }
    throw new HttpError(422, `El código no es correcto. Te quedan ${quedan} intento(s).`).con({ intentosCodigo: quedan });
  }

  await recuperacion.marcarVerificada(id);
  res.json({ verificado: true });
}

/** POST /auth/recuperar/cambiar — paso 3: guardar la contraseña nueva. */
export async function cambiar(req, res) {
  const { solicitud: id, password } = req.validado.body;
  const solicitud = await recuperacion.buscarVigente(id);
  if (!solicitud?.verificado) {
    throw new HttpError(410, 'La solicitud venció o no se verificó. Vuelve a empezar.');
  }

  await enTransaccion(async (db) => {
    await usuariosModel.actualizar(db, solicitud.usuario_id, [
      ['password_hash', await cifrarPassword(password)],
      // Si estaba bloqueada por intentos de inicio de sesión, se desbloquea
      ['intentos_fallidos', 0],
      ['bloqueado_hasta', null],
    ]);
    // Cierra las sesiones abiertas (por si alguien más tenía acceso)
    await usuariosModel.subirVersionSesion(solicitud.usuario_id, db);
    await recuperacion.marcarUsada(db, id);
  });

  await eventos.registrar({
    tipo: 'password_recuperada',
    gravedad: 'Alerta',
    usuarioId: solicitud.usuario_id,
    ...origen(req),
  });
  res.json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
}
