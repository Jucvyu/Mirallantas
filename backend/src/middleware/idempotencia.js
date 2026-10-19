import { HttpError } from '../errores.js';

/**
 * Clave de idempotencia: evita registrar dos veces el mismo pago.
 *
 * El frontend genera un identificador único (UUID) cada vez que abre el
 * formulario de un abono o de una cotización y lo envía en la cabecera
 * `Idempotency-Key`. Si por un doble clic o un reintento de la red llega
 * la misma petición otra vez, la API devuelve lo que ya se registró en
 * lugar de crear un duplicado (la base además tiene la columna UNIQUE).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devuelve la clave de la petición, o null si no trae. */
export function claveIdempotencia(req) {
  const clave = req.get('Idempotency-Key');
  if (!clave) return null;
  if (!UUID.test(clave)) throw new HttpError(400, 'La cabecera Idempotency-Key debe ser un UUID.');
  return clave.toLowerCase();
}
