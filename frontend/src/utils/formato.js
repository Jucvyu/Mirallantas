// =========================================================================
// Formatos de dinero y fechas que usa toda la aplicación.
//
// La API maneja los montos como números enteros en pesos (1968000) y la
// pantalla los muestra con formato colombiano ("$ 1.968.000").
// =========================================================================

/** 1968000 → "$ 1.968.000" */
export function formatCOP(valor) {
  return `$ ${Number(valor || 0).toLocaleString('es-CO')}`;
}

/** "$ 1.968.000" (o "1.968.000", o 1968000) → 1968000 */
export function parseCOP(texto) {
  return Number(String(texto ?? '').replace(/\D/g, '')) || 0;
}

/** Monto que puede faltar (p. ej. una línea sin precio): null → "—". */
export function formatCOPoGuion(valor) {
  return valor === null || valor === undefined ? '—' : formatCOP(valor);
}

/** Fecha de hoy en formato AAAA-MM-DD (la que usa <input type="date">). */
export function hoyISO() {
  const hoy = new Date();
  // Se arma a mano para usar la fecha local y no la de UTC
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/** Texto vacío → null (la API espera null en los campos opcionales). */
export function vacioANull(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/**
 * Fecha en el formato estándar del sistema: AAAA-MM-DD (año-mes-día).
 * Acepta "2026-10-20", un timestamp ISO o un Date. Un timestamp se pasa a la
 * fecha local del navegador; una fecha sola se toma tal cual (sin desfase).
 * Con `conHora` agrega "HH:MM".
 */
export function fechaISO(valor, { conHora = false } = {}) {
  if (!valor) return '';
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor).slice(0, 10);
  const dos = (n) => String(n).padStart(2, '0');
  const fecha = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  return conHora ? `${fecha} ${dos(d.getHours())}:${dos(d.getMinutes())}` : fecha;
}
