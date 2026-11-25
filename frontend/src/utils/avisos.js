// Utilidades de las notificaciones (campana del panel y del portal).

/** Código del registro en el título de un aviso: "Pago aprobado · PED-2026-014" → "PED-2026-014". */
export function codigoDeAviso(n) {
  const texto = `${n?.titulo ?? ''} ${n?.mensaje ?? ''}`;
  return texto.match(/\b[A-Z]{2,5}-\d{4}-\d{2,}(?:-\d+)?\b/)?.[0] ?? texto.match(/\b[A-Z]{2,5}-\d{3,}\b/)?.[0] ?? null;
}
