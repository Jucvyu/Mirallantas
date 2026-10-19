import { query } from '../db.js';
import { POOL } from './listado.model.js';

/**
 * Modelo de notificaciones del cliente (tabla `notificacion`). Avisan al
 * cliente de lo que hizo el asesor: precio de un servicio, pagos y abonos
 * aprobados o rechazados, créditos aprobados o no.
 */

/** Crea una notificación. `db` permite hacerlo dentro de una transacción. */
export async function crear({ clienteId, titulo, mensaje, enlace = null, tipo = 'info' }, db = POOL) {
  await db.query(
    'INSERT INTO notificacion (cliente_id, titulo, mensaje, enlace, tipo) VALUES ($1, $2, $3, $4, $5)',
    [clienteId, titulo, mensaje, enlace, tipo],
  );
}

/** Las 30 más recientes del cliente y cuántas no ha leído. */
export async function listar(clienteId) {
  const { rows } = await query(
    `SELECT id, titulo, mensaje, enlace, tipo, leida, creado_en AS fecha
       FROM notificacion WHERE cliente_id = $1
      ORDER BY creado_en DESC, id DESC LIMIT 30`,
    [clienteId],
  );
  const { rows: sinLeer } = await query(
    'SELECT COUNT(*)::int AS n FROM notificacion WHERE cliente_id = $1 AND NOT leida',
    [clienteId],
  );
  return { notificaciones: rows, sinLeer: sinLeer[0].n };
}

/** Marca como leídas todas las del cliente. */
export async function marcarLeidas(clienteId) {
  await query('UPDATE notificacion SET leida = TRUE WHERE cliente_id = $1 AND NOT leida', [clienteId]);
}
