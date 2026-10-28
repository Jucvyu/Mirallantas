import { enviarDato } from './respuesta.view.js';

/**
 * Vista de usuarios y sesión: decide qué datos de una cuenta salen en las
 * respuestas. El hash de la contraseña y el secreto del doble factor nunca
 * se incluyen.
 */

/** Forma pública del usuario en sesión. */
export function usuarioPublico(u) {
  return {
    id: u.id,
    nombre: u.nombre,
    correo: u.correo,
    tipoDocumento: u.tipo_documento,
    numeroDocumento: u.numero_documento,
    telefono: u.telefono,
    foto: u.foto_url,
    // Solo las cuentas del portal tienen dirección (la de su ficha de cliente)
    direccion: u.direccion ?? null,
    rol: u.rol,
    permisos: u.permisos,
    // Nivel 3: qué puede hacer en cada módulo { Clientes: { crear, editar, eliminar } }
    privilegios: u.privilegios ?? {},
    // Solo el rol Cliente usa el portal; los demás roles no quedan atados a una ficha
    clienteId: u.rol === 'Cliente' ? u.cliente_id : null,
    dosFactores: Boolean(u.totp_activo),
  };
}

/**
 * Respuesta de login y registro: el token y el usuario. `debeActivar2fa`
 * avisa al frontend que el Administrador debe configurar el doble factor.
 */
export function enviarSesion(res, token, usuario, { estado = 200, debeActivar2fa = false } = {}) {
  res.status(estado).json({ token, usuario: { ...usuarioPublico(usuario), debeActivar2fa } });
}

/** La contraseña fue correcta pero falta el código de 6 dígitos. */
export function enviarDesafio2fa(res, desafio) {
  res.json({ requiere2fa: true, desafio });
}

/** Datos para configurar el doble factor: el QR y el secreto para escribirlo a mano. */
export function enviarConfiguracion2fa(res, { secreto, direccion }) {
  res.json({ secreto, direccion });
}

/** Respuesta con el usuario en sesión (GET /auth/yo). */
export function enviarYo(res, usuarioEnSesion) {
  // Los permisos viajan como lista (en memoria son un Set)
  res.json({ usuario: { ...usuarioEnSesion, permisos: [...usuarioEnSesion.permisos] } });
}

/** Respuesta después de editar el perfil propio. */
export function enviarPerfil(res, usuario) {
  res.json({ usuario: usuarioPublico(usuario) });
}

/** Una cuenta del módulo Usuarios. */
export function enviarUsuario(res, usuario, estado = 200) {
  enviarDato(res, usuario, estado);
}
