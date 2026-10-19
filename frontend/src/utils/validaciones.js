// =========================================================================
// Reglas de validación de los formularios.
//
// Son las mismas que aplica la API (backend/src/validators): aquí sirven
// para avisar MIENTRAS el usuario escribe. Quien de verdad decide es el
// servidor, que vuelve a revisar todo antes de guardar.
// =========================================================================

/** Correo con forma nombre@dominio.ext */
export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Teléfono: dígitos y espacios, con un + inicial opcional (7 a 20). */
export const TELEFONO_VALIDO = /^\+?[0-9 ]{7,20}$/;

/** Número de documento: dígitos, letras y guion (5 a 20). */
export const DOCUMENTO_VALIDO = /^[0-9A-Za-z-]{5,20}$/;

/** Mensaje de error de una contraseña nueva, o '' si cumple. */
export function errorPassword(password) {
  if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (password.length > 72) return 'La contraseña admite máximo 72 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password)) return 'La contraseña debe tener al menos una letra.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número.';
  return '';
}

/** ¿El valor está vacío? (texto en blanco, lista vacía, nulo) */
export const estaVacio = (valor) => (Array.isArray(valor) ? valor.length === 0 : !String(valor ?? '').trim());

/**
 * Error de un campo del formulario según su tipo, o '' si está bien.
 *
 * campo: { key, type, required, max, validar }
 *   max      largo máximo del texto (por defecto 200; 500 en textarea)
 *   validar  (valor, valores) => mensaje | '' para reglas propias del campo
 */
export function errorDeCampo(campo, valor, valores = {}) {
  const { key, type = 'text', required } = campo;
  if (estaVacio(valor)) return required ? 'Este campo es obligatorio' : '';

  const texto = String(valor).trim();
  if (type === 'email' && !CORREO_VALIDO.test(texto)) return 'Escribe un correo válido, por ejemplo nombre@correo.com';
  if (type === 'tel' && !TELEFONO_VALIDO.test(texto)) return 'Escribe un teléfono válido (7 a 20 dígitos)';
  if (key === 'numeroDocumento' && !DOCUMENTO_VALIDO.test(texto)) return 'El documento debe tener entre 5 y 20 caracteres';
  if (type === 'password') {
    const problema = errorPassword(String(valor));
    if (problema) return problema;
  }
  if (['text', 'textarea', 'email'].includes(type)) {
    const maximo = campo.max ?? (type === 'textarea' ? 500 : 200);
    if (texto.length > maximo) return `Máximo ${maximo} caracteres (llevas ${texto.length})`;
  }
  return campo.validar?.(valor, valores) || '';
}
