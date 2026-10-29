import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { config } from '../config.js';
import {
  debeActivar2fa,
  errorCuentaInactiva,
  firmarDesafio2fa,
  firmarToken,
  leerToken,
  origen,
} from '../middleware/auth.js';
import * as clientesModel from '../models/clientes.model.js';
import * as eventos from '../models/eventos.model.js';
import * as rolesModel from '../models/roles.model.js';
import * as usuariosModel from '../models/usuarios.model.js';
import { aPares } from '../models/listado.model.js';
import { exigirCaptcha } from '../utils/captcha.js';
import { cifrar, descifrar } from '../utils/cifrado.js';
import { cifrarPassword, compararPassword, HASH_RELLENO } from '../utils/contrasenas.js';
import { correoDeGoogle, googleDisponible } from '../utils/google.js';
import * as totp from '../utils/totp.js';
import * as vista from '../views/usuarios.view.js';

/**
 * Controlador de sesión: iniciar y cerrar sesión, registrarse, editar el
 * perfil y el doble factor.
 *
 * Un controlador lee lo que llegó en la petición (ya validado en
 * `req.validado`), aplica las reglas, pide los datos al modelo y responde
 * a través de la vista.
 */

/** Minutos que faltan para que termine un bloqueo. */
const minutosRestantes = (hasta) => Math.max(1, Math.ceil((new Date(hasta) - Date.now()) / 60000));

/** Rechaza el intento si la cuenta está bloqueada por intentos fallidos. */
function exigirNoBloqueado(usuario) {
  if (usuario?.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
    throw new HttpError(
      429,
      `Demasiados intentos fallidos. La cuenta está bloqueada por ${minutosRestantes(usuario.bloqueado_hasta)} minuto(s).`,
    );
  }
}

/** Cuenta un intento fallido y lo deja en la bitácora. */
async function registrarFallo(req, usuario, tipo, correo) {
  const bloqueado = usuario ? await usuariosModel.registrarFallo(usuario.id) : false;
  await eventos.registrar({
    tipo: bloqueado ? 'cuenta_bloqueada' : tipo,
    gravedad: bloqueado ? 'Alta' : 'Alerta',
    usuarioId: usuario?.id,
    correo: usuario?.correo ?? correo,
    ...origen(req),
    detalle: bloqueado ? `Bloqueada ${usuariosModel.MINUTOS_BLOQUEO} min tras ${usuariosModel.MAXIMO_INTENTOS} intentos` : null,
  });
}

/**
 * Último paso de cualquier inicio de sesión: limpia los intentos
 * fallidos, avisa si es una IP nueva para la cuenta y entrega el token.
 */
async function completarInicio(req, res, usuario) {
  const { ip, agente } = origen(req);
  // Acceso sospechoso: el personal entra desde una IP que nunca había usado
  if (usuario.ultimo_acceso !== null && !usuario.cliente_id && !(await eventos.ipConocida(usuario.id, ip))) {
    await eventos.registrar({
      tipo: 'ip_nueva',
      gravedad: 'Alta',
      usuarioId: usuario.id,
      correo: usuario.correo,
      ip,
      agente,
      detalle: `Antes: ${usuario.ultima_ip ?? 'sin registro'}`,
    });
  }
  await usuariosModel.registrarAcceso(usuario.id, ip);
  // Una cuenta, un dispositivo: la sesión nueva cierra las demás (sus tokens dejan de servir)
  await usuariosModel.subirVersionSesion(usuario.id);
  usuario.version_sesion += 1;
  await eventos.registrar({ tipo: 'inicio_sesion', usuarioId: usuario.id, correo: usuario.correo, ip, agente });
  vista.enviarSesion(res, firmarToken(usuario), usuario, { debeActivar2fa: debeActivar2fa(usuario) });
}

/** POST /auth/captcha — comprueba el captcha y nada más. */
export async function verificarCaptcha(req, res) {
  await exigirCaptcha(req.validado.body.captcha, req.ip);
  res.status(204).end();
}

/** POST /auth/login */
export async function iniciarSesion(req, res) {
  const { correo, password, captcha } = req.validado.body;
  // Primero el captcha: sin superarlo ni siquiera se revisa la contraseña
  await exigirCaptcha(captcha, req.ip);
  const usuario = await usuariosModel.buscarCuenta({ correo });
  exigirNoBloqueado(usuario);

  const coincide = await compararPassword(password, usuario?.password_hash ?? HASH_RELLENO);
  if (!usuario || !coincide) {
    await registrarFallo(req, usuario, 'inicio_fallido', correo);
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  // La contraseña es correcta, pero la cuenta (o su rol) está inactiva.
  // Solo se avisa después de comprobar la contraseña.
  if (!usuariosModel.cuentaHabilitada(usuario)) {
    await eventos.registrar({ tipo: 'acceso_cuenta_inactiva', gravedad: 'Alerta', usuarioId: usuario.id, correo, ...origen(req) });
    throw errorCuentaInactiva();
  }

  // Con doble factor, la contraseña sola no basta: se pide el código
  if (usuario.totp_activo) return vista.enviarDesafio2fa(res, firmarDesafio2fa(usuario));
  await completarInicio(req, res, usuario);
}

/**
 * POST /auth/google — iniciar sesión con Google.
 *
 * Solo entra quien ya tiene cuenta con ese mismo correo: tener Gmail no da
 * acceso. Se aplican las mismas reglas que con contraseña (bloqueo, cuenta
 * inactiva y doble factor).
 */
export async function iniciarConGoogle(req, res) {
  if (!googleDisponible()) throw new HttpError(503, 'El inicio de sesión con Google no está disponible.');
  await exigirCaptcha(req.validado.body.captcha, req.ip);
  const correo = await correoDeGoogle(req.validado.body.credencial);
  const usuario = await usuariosModel.buscarCuenta({ correo });
  if (!usuario) {
    await eventos.registrar({ tipo: 'inicio_google_sin_cuenta', gravedad: 'Alerta', correo, ...origen(req) });
    throw new HttpError(404, 'No hay una cuenta con este correo de Google. Regístrate primero o entra con tu contraseña.');
  }
  exigirNoBloqueado(usuario);
  if (!usuariosModel.cuentaHabilitada(usuario)) {
    await eventos.registrar({ tipo: 'acceso_cuenta_inactiva', gravedad: 'Alerta', usuarioId: usuario.id, correo, ...origen(req) });
    throw errorCuentaInactiva();
  }

  if (usuario.totp_activo) return vista.enviarDesafio2fa(res, firmarDesafio2fa(usuario));
  await completarInicio(req, res, usuario);
}

/** POST /auth/2fa/verificar — segundo paso del inicio de sesión. */
export async function verificarDobleFactor(req, res) {
  const { desafio, codigo } = req.validado.body;
  const carga = leerToken(desafio, '2fa');
  const usuario = await usuariosModel.buscarSesion({ id: Number(carga.sub) });
  if (!usuario || carga.ver !== usuario.version_sesion || !usuario.totp_activo) {
    throw new HttpError(401, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
  }
  exigirNoBloqueado(usuario);

  const paso = totp.pasoDelCodigo(descifrar(usuario.totp_secreto), codigo);
  if (paso === null) {
    await registrarFallo(req, usuario, 'codigo_2fa_fallido');
    throw new HttpError(401, 'El código no es correcto. Revisa la hora de tu celular e inténtalo de nuevo.');
  }
  // Un código ya usado no vuelve a servir, aunque siga vigente
  if (!(await usuariosModel.usarPasoTotp(usuario.id, paso))) {
    await registrarFallo(req, usuario, 'codigo_2fa_repetido');
    throw new HttpError(401, 'Ese código ya se usó. Espera a que tu app muestre el siguiente.');
  }
  await completarInicio(req, res, usuario);
}

/** POST /auth/salir — cierra la sesión en todos los dispositivos. */
export async function cerrarSesion(req, res) {
  await usuariosModel.subirVersionSesion(req.usuario.id);
  await eventos.registrar({ tipo: 'cierre_sesion', usuarioId: req.usuario.id, correo: req.usuario.correo, ...origen(req) });
  res.status(204).end();
}

/** POST /auth/registro — crea la ficha de cliente y su cuenta. */
export async function registrarse(req, res) {
  const d = req.validado.body;
  // Sin superar el captcha no se crea la cuenta
  await exigirCaptcha(d.captcha, req.ip);

  const id = await enTransaccion(async (db) => {
    // Un correo, documento o teléfono no se repite entre cuentas, y el
    // registro público no se liga a una ficha de cliente que ya existe
    // (cualquiera podría escribir un documento ajeno y ver sus pedidos).
    // El mensaje es genérico a propósito: no revela qué dato ya existe.
    await usuariosModel.bloquearDatosUnicos(db);
    const repetido =
      (await usuariosModel.datoRepetido(db, d)) ||
      (await clientesModel.idPorDocumento(db, d.tipoDocumento, d.numeroDocumento));
    if (repetido) throw new HttpError(409, 'No pudimos crear tu usuario.');
    const clienteId = await clientesModel.crear(db, d);
    return usuariosModel.crear(db, {
      ...d,
      passwordHash: await cifrarPassword(d.password),
      rolId: await rolesModel.idPorNombre(db, rolesModel.ROL_CLIENTE),
      clienteId,
    });
  });

  await eventos.registrar({ tipo: 'registro', usuarioId: id, correo: d.correo, ...origen(req) });
  // Queda con la sesión iniciada
  const usuario = await usuariosModel.buscarSesion({ id });
  await usuariosModel.registrarAcceso(id, req.ip);
  vista.enviarSesion(res, firmarToken(usuario), usuario, { estado: 201 });
}

/** GET /auth/yo — el usuario en sesión (lo cargó el middleware `autenticar`). */
export function verPerfil(req, res) {
  vista.enviarYo(res, req.usuario);
}

/** Exige la contraseña actual antes de una acción sensible. */
async function exigirPasswordActual(usuario, passwordActual) {
  if (!passwordActual || !(await compararPassword(passwordActual, usuario.password_hash))) {
    throw new HttpError(422, 'La contraseña actual no es correcta.', [
      { campo: 'passwordActual', mensaje: 'Escribe tu contraseña actual para confirmar el cambio.' },
    ]);
  }
}

/**
 * PUT /auth/yo — el usuario actualiza su propio perfil.
 *
 * Cambiar la contraseña o el correo es una acción sensible: pide la
 * contraseña actual y cierra las demás sesiones (se entrega un token nuevo).
 */
export async function actualizarPerfil(req, res) {
  const { password, passwordActual, direccion, foto, ...datos } = req.validado.body;
  const { id, clienteId } = req.usuario;
  const actual = await usuariosModel.buscarSesion({ id });

  const cambiaCorreo = datos.correo !== undefined && datos.correo !== actual.correo;
  const sensible = Boolean(password) || cambiaCorreo;
  if (sensible) await exigirPasswordActual(actual, passwordActual);
  if (!cambiaCorreo) delete datos.correo;

  await enTransaccion(async (db) => {
    // Correo, documento o teléfono nuevos: no pueden ser los de otra cuenta
    if (['correo', 'numeroDocumento', 'telefono'].some((c) => datos[c] !== undefined)) {
      await usuariosModel.bloquearDatosUnicos(db);
      const nuevos = {
        correo: datos.correo ?? actual.correo,
        numeroDocumento: datos.numeroDocumento ?? actual.numero_documento,
        telefono: datos.telefono ?? actual.telefono,
      };
      if (await usuariosModel.datoRepetido(db, nuevos, id)) throw new HttpError(409, 'No pudimos actualizar tu perfil.');
    }
    const pares = aPares(datos, usuariosModel.COLUMNAS);
    if (foto !== undefined) pares.push(['foto_url', foto]);
    // La contraseña solo cambia si se escribió una nueva
    if (password) pares.push(['password_hash', await cifrarPassword(password)]);
    await usuariosModel.actualizar(db, id, pares);
    if (sensible) await usuariosModel.subirVersionSesion(id, db);

    // Un cliente del portal también actualiza su ficha de cliente
    if (clienteId) await clientesModel.actualizarContacto(db, clienteId, { ...datos, direccion });
  });

  const usuario = await usuariosModel.buscarSesion({ id });
  if (!sensible) return vista.enviarPerfil(res, usuario);

  await eventos.registrar({
    tipo: password ? 'cambio_password' : 'cambio_correo',
    gravedad: 'Alerta',
    usuarioId: id,
    correo: usuario.correo,
    ...origen(req),
  });
  vista.enviarSesion(res, firmarToken(usuario), usuario, { debeActivar2fa: debeActivar2fa(usuario) });
}

// ---- Doble factor -----------------------------------------------------------------

/** POST /auth/2fa/configurar — genera un secreto nuevo (aún sin activar). */
export async function configurarDobleFactor(req, res) {
  const usuario = await usuariosModel.buscarSesion({ id: req.usuario.id });
  if (usuario.totp_activo) throw new HttpError(409, 'La verificación en dos pasos ya está activa.');

  const secreto = totp.generarSecreto();
  await usuariosModel.guardarDobleFactor(usuario.id, { secretoCifrado: cifrar(secreto), activo: false });
  vista.enviarConfiguracion2fa(res, { secreto, direccion: totp.direccionOtpauth(secreto, usuario.correo) });
}

/** POST /auth/2fa/activar — confirma con un código que la app quedó bien configurada. */
export async function activarDobleFactor(req, res) {
  const usuario = await usuariosModel.buscarSesion({ id: req.usuario.id });
  if (usuario.totp_activo) throw new HttpError(409, 'La verificación en dos pasos ya está activa.');
  if (!usuario.totp_secreto) throw new HttpError(422, 'Primero genera el código QR.');
  if (!totp.verificarCodigo(descifrar(usuario.totp_secreto), req.validado.body.codigo)) {
    throw new HttpError(422, 'El código no es correcto. Revisa la hora de tu celular e inténtalo de nuevo.');
  }

  await usuariosModel.guardarDobleFactor(usuario.id, { secretoCifrado: usuario.totp_secreto, activo: true });
  // Las demás sesiones abiertas se cierran: deben entrar ya con el código
  await usuariosModel.subirVersionSesion(usuario.id);
  await eventos.registrar({ tipo: '2fa_activado', usuarioId: usuario.id, correo: usuario.correo, ...origen(req) });

  const actualizado = await usuariosModel.buscarSesion({ id: usuario.id });
  vista.enviarSesion(res, firmarToken(actualizado), actualizado);
}

/** POST /auth/2fa/desactivar — pide contraseña y código vigente. */
export async function desactivarDobleFactor(req, res) {
  const { passwordActual, codigo } = req.validado.body;
  const usuario = await usuariosModel.buscarSesion({ id: req.usuario.id });
  if (!usuario.totp_activo) throw new HttpError(409, 'La verificación en dos pasos no está activa.');
  if (config.exigir2faAdmin && usuario.rol === rolesModel.ROL_ADMIN) {
    throw new HttpError(422, 'El Administrador debe mantener activa la verificación en dos pasos.');
  }
  await exigirPasswordActual(usuario, passwordActual);
  if (!totp.verificarCodigo(descifrar(usuario.totp_secreto), codigo)) {
    throw new HttpError(422, 'El código no es correcto.');
  }

  await usuariosModel.guardarDobleFactor(usuario.id, { secretoCifrado: null, activo: false });
  await eventos.registrar({
    tipo: '2fa_desactivado',
    gravedad: 'Alerta',
    usuarioId: usuario.id,
    correo: usuario.correo,
    ...origen(req),
  });
  vista.enviarPerfil(res, await usuariosModel.buscarSesion({ id: usuario.id }));
}
