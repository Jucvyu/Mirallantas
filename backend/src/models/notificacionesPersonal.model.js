import { query } from '../db.js';
import { POOL } from './listado.model.js';

/**
 * Modelo de avisos para el personal (tabla `notificacion_personal`). Cada
 * aviso pertenece a un módulo y lo ve quien tenga permiso de ese módulo.
 * Por ahora solo los manda Pedidos-Cotización: cotización nueva desde el
 * portal y pago de contado vuelto a subir.
 *
 * "Sin leer" son los creados después de `usuario.notificaciones_vistas_en`.
 */

/** Crea un aviso. `db` permite hacerlo dentro de una transacción. */
export async function crear({ modulo, titulo, mensaje, enlace = null, tipo = 'info' }, db = POOL) {
  await db.query(
    'INSERT INTO notificacion_personal (modulo, titulo, mensaje, enlace, tipo) VALUES ($1, $2, $3, $4, $5)',
    [modulo, titulo, mensaje, enlace, tipo],
  );
}

/** Nombre del cliente, para escribirlo en el aviso. */
export async function nombreCliente(db, clienteId) {
  const { rows } = await db.query('SELECT nombre_completo FROM cliente WHERE id = $1', [clienteId]);
  return rows[0]?.nombre_completo ?? 'Un cliente';
}

/** Los 30 avisos más recientes de los módulos indicados y cuántos no ha visto el usuario. */
export async function listar(usuarioId, modulos) {
  const { rows } = await query(
    `SELECT n.id, n.titulo, n.mensaje, n.enlace, n.tipo, n.creado_en AS fecha,
            n.creado_en <= u.notificaciones_vistas_en AS leida
       FROM notificacion_personal n
       JOIN usuario u ON u.id = $1
      WHERE n.modulo = ANY($2)
      ORDER BY n.creado_en DESC, n.id DESC LIMIT 30`,
    [usuarioId, modulos],
  );
  const { rows: sinLeer } = await query(
    `SELECT COUNT(*)::int AS n
       FROM notificacion_personal n JOIN usuario u ON u.id = $1
      WHERE n.modulo = ANY($2) AND n.creado_en > u.notificaciones_vistas_en`,
    [usuarioId, modulos],
  );
  return { notificaciones: rows, sinLeer: sinLeer[0].n };
}

/** Marca como vistos todos los avisos hasta este momento. */
export async function marcarLeidas(usuarioId) {
  await query('UPDATE usuario SET notificaciones_vistas_en = now() WHERE id = $1', [usuarioId]);
}
