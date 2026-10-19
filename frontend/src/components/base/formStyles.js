/**
 * Estilos compartidos de los campos de formulario.
 *
 * Todos los formularios del ERP (los del esquema en `FormModal` y los que
 * se arman a mano, como "Nuevo pedido" o "Registrar entrega") importan
 * estas constantes para que los inputs se vean igual en toda la app.
 *
 * El diseño se aleja del input plano del navegador: esquinas más suaves,
 * fondo propio, una línea inferior en ámbar que aparece al enfocar y un
 * halo del mismo tono en lugar del contorno azul del sistema.
 */

/** Caja base de cualquier campo de texto, número, fecha o área. */
export const INPUT =
  'w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm ' +
  'transition-all duration-150 placeholder:font-normal placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-4 focus:ring-amber-400/15 ' +
  '[color-scheme:light] dark:[color-scheme:dark] ' +
  'dark:bg-brand-navy-900/70 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500';

/** Contorno en reposo: gris muy tenue que se aviva al pasar el cursor. */
export const BORDER_OK =
  'border-slate-200 hover:border-slate-300 focus:border-amber-400 ' +
  'dark:border-white/10 dark:hover:border-white/20 dark:focus:border-amber-400/70';

/** Contorno cuando el campo tiene un error de validación. */
export const BORDER_ERR =
  'border-red-400 focus:border-red-400 focus:ring-red-400/15 dark:border-red-500/60';

/** Campo completo listo para usar, sin estado de error. */
export const CAMPO = `${INPUT} ${BORDER_OK}`;

/** Etiqueta que va encima de cada campo. */
export const LABEL = 'mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200';

/** Título de un bloque de campos dentro del formulario. */
export const SECTION =
  'text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500';

/** Devuelve la caja con el contorno que corresponda al estado del campo. */
export function campo(error) {
  return `${INPUT} ${error ? BORDER_ERR : BORDER_OK}`;
}

// -------------------------------------------------------------------------
// Saneo de los campos numéricos
//
// Los campos de dinero, cantidades y teléfonos no deben aceptar letras: en
// vez de validarlo al enviar, se filtra lo que se escribe.
// -------------------------------------------------------------------------

/** Deja solo dígitos. */
export function soloDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

/** Dígitos con separador de miles, para los importes en pesos. */
export function formatoMiles(texto) {
  const digitos = soloDigitos(texto);
  return digitos ? Number(digitos).toLocaleString('es-CO') : '';
}

/** Teléfonos: dígitos y los signos habituales de un número de contacto. */
export function soloTelefono(texto) {
  return String(texto ?? '').replace(/[^\d+\-() ]/g, '');
}
