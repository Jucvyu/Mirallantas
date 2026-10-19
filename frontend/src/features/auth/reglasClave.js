// =========================================================================
// Reglas de contraseña y del formulario "Mi perfil".
//
// Son las mismas que aplica la API (backend/src/validators): aquí solo
// sirven para avisar antes de enviar.
// =========================================================================

import { errorPassword } from '../../utils/validaciones';

// La regla de la contraseña está en utils/validaciones.js; se reexporta aquí
// porque el perfil, el registro y la recuperación la importan de este archivo.
export { errorPassword };

/** Texto de ayuda que se muestra bajo el campo de contraseña. */
export const AYUDA_PASSWORD = 'Mínimo 10 caracteres, con letras y números.';

/** Campo "Contraseña actual" del perfil: confirma los cambios sensibles. */
export const CAMPO_PASSWORD_ACTUAL = {
  key: 'passwordActual',
  label: 'Contraseña actual',
  type: 'password',
  span: 2,
  placeholder: 'Solo si cambias la contraseña o el correo',
};

/**
 * Validación del perfil propio: la contraseña nueva debe ser robusta y,
 * para cambiarla o cambiar el correo, hay que escribir la actual.
 */
export const validarPerfil = (perfil) => (valores) => {
  const errores = {};
  if (valores.password) {
    const problema = errorPassword(valores.password);
    if (problema) errores.password = problema;
  }
  const cambiaCorreo = valores.correo && valores.correo.trim().toLowerCase() !== perfil.correo;
  if ((valores.password || cambiaCorreo) && !valores.passwordActual) {
    errores.passwordActual = 'Escribe tu contraseña actual para confirmar el cambio.';
  }
  return errores;
};
