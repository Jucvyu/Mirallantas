// =========================================================================
// Reglas de validación de los formularios.
//
// Son las mismas que aplica la API (backend/src/validators): aquí sirven
// para avisar MIENTRAS el usuario escribe. Quien de verdad decide es el
// servidor, que vuelve a revisar todo antes de guardar.
// =========================================================================

/** Correo con forma nombre@dominio.ext */
export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Teléfono colombiano: celular (3 + 9 dígitos) o fijo (60 + 8 dígitos), +57 opcional, sin espacios. */
export const TELEFONO_VALIDO = /^(\+57)?(3\d{9}|60\d{8})$/;

/** Número de documento: dígitos, letras y guion (5 a 20). */
export const DOCUMENTO_VALIDO = /^[0-9A-Za-z-]{5,20}$/;

/** Formato del número según el tipo de documento (reglas colombianas). */
export const REGLAS_DOCUMENTO = {
  CC: [/^\d{6,10}$/, 'La cédula de ciudadanía tiene de 6 a 10 dígitos.'],
  CE: [/^[0-9A-Za-z]{6,12}$/, 'La cédula de extranjería tiene de 6 a 12 letras o números.'],
  NIT: [/^\d{9,10}(-\d)?$/, 'El NIT tiene 9 o 10 dígitos (con guion y dígito de verificación opcional).'],
  Pasaporte: [/^[0-9A-Za-z]{6,15}$/, 'El pasaporte tiene de 6 a 15 letras o números.'],
};

/** Nombres de personas: letras (con tildes y ñ), espacios, punto y apóstrofo. */
const LETRAS_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.' ]+$/;
const ALGUNA_LETRA = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

/** Mínimo de caracteres de una descripción, motivo u observación. */
export const MINIMO_EXPLICACION = 10;

/**
 * Máximo de caracteres de los textos que se escriben (nombres, direcciones,
 * descripciones, motivos, observaciones, correos). Igual que la API.
 */
export const MAX_TEXTO = 80;

/**
 * Máximo de un campo según su tipo: los textos largos llevan MAX_TEXTO; los
 * cortos, el suyo (o el que diga `campo.max`).
 */
export function maximoDe(campo) {
  if (campo.max) return campo.max;
  if (campo.key === 'numeroDocumento' || campo.type === 'documento') return 15;
  if (campo.type === 'tel') return 20;
  if (campo.type === 'password') return 72;
  return MAX_TEXTO;
}

/** Mensaje de error del número de documento según su tipo, o ''. */
export function errorDocumento(numero, tipoDocumento) {
  const texto = String(numero ?? '').trim();
  const regla = REGLAS_DOCUMENTO[tipoDocumento];
  if (regla) return regla[0].test(texto) ? '' : regla[1];
  return DOCUMENTO_VALIDO.test(texto) ? '' : 'El documento debe tener entre 5 y 20 caracteres';
}

/** Mensaje de error de un teléfono colombiano, o ''. */
export const errorTelefono = (valor) =>
  TELEFONO_VALIDO.test(String(valor ?? '').replace(/[\s-]/g, ''))
    ? ''
    : 'Escribe un celular (3xx xxx xxxx) o un fijo (60x xxx xxxx) colombiano';

/** Mensaje de error de una contraseña nueva, o '' si cumple. */
export function errorPassword(password) {
  if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (password.length > 72) return 'La contraseña admite máximo 72 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password)) return 'La contraseña debe tener al menos una letra.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número.';
  return '';
}

/** ¿El valor está vacío? (texto en blanco, lista vacía, nulo) */
export const estaVacio = (valor) => {
  if (Array.isArray(valor)) return valor.length === 0;
  // Objetos (p. ej. los privilegios de un rol): vacío si no tiene nada
  if (valor && typeof valor === 'object') return Object.keys(valor).length === 0;
  return !String(valor ?? '').trim();
};

/**
 * Error de un campo del formulario según su tipo, o '' si está bien.
 *
 * campo: { key, type, required, max, nombrePersona, validar }
 *   max            largo máximo del texto (por defecto MAX_TEXTO = 80)
 *   nombrePersona  nombre de una persona: mínimo 3 y solo letras
 *   validar        (valor, valores) => mensaje | '' para reglas propias del campo
 *
 * Además: nombres de empresas y del catálogo con mínimo 2 y alguna letra,
 * textos largos con mínimo 10, cantidades de 1 a 999 y valores obligatorios
 * en pesos mayores que cero.
 */
export function errorDeCampo(campo, valor, valores = {}) {
  const { key, type = 'text', required } = campo;
  if (estaVacio(valor)) return required ? 'Este campo es obligatorio' : '';

  const texto = String(valor).trim();
  if (type === 'email' && !CORREO_VALIDO.test(texto)) return 'Escribe un correo válido, por ejemplo nombre@correo.com';
  if (type === 'tel') {
    const problema = errorTelefono(texto);
    if (problema) return problema;
  }
  if (key === 'numeroDocumento') {
    const problema = errorDocumento(texto, valores.tipoDocumento);
    if (problema) return problema;
  }
  if (campo.nombrePersona) {
    if (texto.length < 3) return 'El nombre debe tener al menos 3 caracteres';
    if (!LETRAS_NOMBRE.test(texto)) return 'El nombre solo admite letras, espacios, punto y apóstrofo';
  } else if (key === 'nombre' || key === 'nombreRazonSocial') {
    if (texto.length < 2) return 'El nombre debe tener al menos 2 caracteres';
    if (!ALGUNA_LETRA.test(texto)) return 'El nombre no puede ser solo números o símbolos';
  }
  if (type === 'textarea' && texto.length < MINIMO_EXPLICACION) return `Escribe al menos ${MINIMO_EXPLICACION} caracteres`;
  if (type === 'number') {
    const numero = Number(texto);
    if (!(numero >= 1)) return 'Debe ser mayor que cero';
    if (key === 'cantidad' && numero > 999) return 'La cantidad máxima es 999';
  }
  if (type === 'money' && required && !(Number(texto.replace(/\D/g, '')) > 0)) return 'Debe ser mayor que cero';
  if (type === 'password') {
    const problema = errorPassword(String(valor));
    if (problema) return problema;
  }
  if (['text', 'textarea', 'email'].includes(type)) {
    const maximo = maximoDe(campo);
    if (texto.length > maximo) return `Máximo ${maximo} caracteres (llevas ${texto.length})`;
  }
  return campo.validar?.(valor, valores) || '';
}
