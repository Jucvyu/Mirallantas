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
