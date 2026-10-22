import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../errores.js';
import * as eventos from '../models/eventos.model.js';
import { ROL_ADMIN, ROL_CLIENTE } from '../models/roles.model.js';
import { buscarCuenta, cuentaHabilitada } from '../models/usuarios.model.js';
import { usuarioPublico } from '../views/usuarios.view.js';

/**
 * Middlewares de sesión y permisos.
 *
 * Se ponen en las rutas, antes del controlador:
 *   router.use(autenticar, requierePermiso('Clientes'))
 */

/** Datos de la petición que se guardan en la bitácora de seguridad. */
export const origen = (req) => ({ ip: req.ip, agente: req.get('user-agent') });

/**
 * Crea el token de sesión de un usuario (válido por JWT_EXPIRES_IN).
 * `ver` es la versión de sesión del usuario: al cerrar sesión o cambiar la
 * contraseña sube, y todos los tokens anteriores dejan de servir.
 */
export function firmarToken(usuario) {
  return jwt.sign({ sub: String(usuario.id), ver: usuario.version_sesion, tipo: 'sesion' }, config.jwtSecret, {
    expiresIn: config.jwtExpiraEn,
    algorithm: 'HS256',
  });
}

/**
 * Token corto (5 minutos) que se entrega tras la contraseña cuando la
 * cuenta tiene doble factor. Solo sirve para enviar el código de 6 dígitos.
 */
export function firmarDesafio2fa(usuario) {
  return jwt.sign({ sub: String(usuario.id), ver: usuario.version_sesion, tipo: '2fa' }, config.jwtSecret, {
    expiresIn: '5m',
    algorithm: 'HS256',
  });
}

/** Lee y verifica un token. Devuelve su contenido o lanza 401. */
export function leerToken(token, tipo) {
  try {
    const carga = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (carga.tipo !== tipo) throw new Error('Tipo de token incorrecto');
    return carga;
  } catch {
    throw new HttpError(401, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
  }
}

/** Mensaje y código que ve quien tiene la cuenta inactiva. */
export const errorCuentaInactiva = () =>
  new HttpError(
    403,
    'Tu cuenta está inactiva. Pide al administrador que te vuelva a activar.',
    undefined,
    'CUENTA_INACTIVA',
  );

/** ¿El usuario debe activar el doble factor antes de usar el panel? */
export const debeActivar2fa = (usuario) => config.exigir2faAdmin && usuario.rol === ROL_ADMIN && !usuario.totp_activo;

/**
 * Exige un token válido. Los permisos se leen de la base en cada petición,
 * así que desactivar un usuario o quitarle un permiso surte efecto al
 * instante, sin esperar a que caduque su token.
 *
 * Un Administrador sin doble factor solo puede usar las rutas de sesión
 * (/api/auth) hasta activarlo.
 */
export async function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) throw new HttpError(401, 'Inicia sesión para continuar.');

  const carga = leerToken(token, 'sesion');
  const usuario = await buscarCuenta({ id: Number(carga.sub) });
  if (!usuario) throw new HttpError(401, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
  // Si la desactivaron con la sesión abierta, se le avisa por qué sale
  if (!cuentaHabilitada(usuario)) throw errorCuentaInactiva();
  // Se inició sesión en otro dispositivo, se cerró desde otro lugar o cambió la contraseña
  if (carga.ver !== usuario.version_sesion) {
    throw new HttpError(401, 'Tu sesión se cerró porque la cuenta se abrió en otro dispositivo. Inicia sesión de nuevo.');
  }

  const pendiente2fa = debeActivar2fa(usuario);
  if (pendiente2fa && req.baseUrl !== '/api/auth') {
    throw new HttpError(403, 'Activa la verificación en dos pasos para continuar.', undefined, '2FA_REQUERIDO');
  }

  req.usuario = { ...usuarioPublico(usuario), debeActivar2fa: pendiente2fa, permisos: new Set(usuario.permisos) };
  next();
}

/** Registra en la bitácora un intento de acceso sin permiso y lo rechaza. */
function negar(req, mensaje) {
  eventos.registrar({
    tipo: 'acceso_negado',
    gravedad: 'Alerta',
    usuarioId: req.usuario?.id,
    correo: req.usuario?.correo,
    ...origen(req),
    detalle: `${req.method} ${req.originalUrl}`,
  });
  return new HttpError(403, mensaje);
}

/** Exige que el rol del usuario incluya el módulo indicado. */
export const requierePermiso = (modulo) => (req, res, next) => {
  if (!req.usuario?.permisos.has(modulo)) throw negar(req, 'No tienes permiso para esta acción.');
  next();
};

/**
 * Solo el rol Administrador. Protege lo que da poder sobre el sistema:
 * roles, usuarios y la bitácora de seguridad. Así nadie con otro rol puede
 * darse más permisos a sí mismo.
 */
export const soloAdministrador = (req, res, next) => {
  if (req.usuario?.rol !== ROL_ADMIN) throw negar(req, 'Esta sección es solo para el Administrador.');
  next();
};

/**
 * Para usuarios del portal (rol Cliente, ligados a un cliente) devuelve su
 * cliente_id: las consultas de documentos se limitan a sus propios datos.
 * Para el personal interno devuelve null y ven todo lo que su permiso
 * permita. Se mira el ROL, no solo la ficha: si a un cliente lo hacen
 * Administrador, deja de verse limitado aunque la ficha siguiera ligada.
 */
export const clienteDeSesion = (req) => (req.usuario?.rol === ROL_CLIENTE ? (req.usuario.clienteId ?? null) : null);

/**
 * Bloquea a los usuarios del portal. Sirve para acciones que solo hace el
 * personal, como confirmar el valor de una cotización o cambiar su estado,
 * aunque el rol Cliente tenga permiso para ver ese módulo.
 */
export const soloPersonal = (req, res, next) => {
  if (clienteDeSesion(req)) throw negar(req, 'Esta acción la realiza un asesor de MiraLlantas.');
  next();
};
