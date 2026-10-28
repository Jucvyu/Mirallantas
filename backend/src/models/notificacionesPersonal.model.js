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

/** Días que dura un aviso: después se borra solo. */
export const DIAS_VIGENCIA = 7;

/** Borra los avisos de más de DIAS_VIGENCIA días (con lo que cada usuario había borrado de ellos). */
export async function borrarVencidas() {
  await query(`DELETE FROM notificacion_personal WHERE creado_en < now() - make_interval(days => $1)`, [DIAS_VIGENCIA]);
}

/** Los 30 avisos más recientes de los módulos indicados (sin los que el usuario borró) y cuántos no ha visto. */
export async function listar(usuarioId, modulos) {
  await borrarVencidas();
  const { rows } = await query(
    `SELECT n.id, n.titulo, n.mensaje, n.enlace, n.tipo, n.creado_en AS fecha,
            n.creado_en <= u.notificaciones_vistas_en AS leida
       FROM notificacion_personal n
       JOIN usuario u ON u.id = $1
      WHERE n.modulo = ANY($2) AND NOT EXISTS (SELECT 1 FROM notificacion_personal_borrada b WHERE b.usuario_id = u.id AND b.notificacion_id = n.id)
      ORDER BY n.creado_en DESC, n.id DESC LIMIT 30`,
    [usuarioId, modulos],
  );
  const { rows: sinLeer } = await query(
    `SELECT COUNT(*)::int AS n
       FROM notificacion_personal n JOIN usuario u ON u.id = $1
      WHERE n.modulo = ANY($2) AND n.creado_en > u.notificaciones_vistas_en AND NOT EXISTS (SELECT 1 FROM notificacion_personal_borrada b WHERE b.usuario_id = u.id AND b.notificacion_id = n.id)`,
    [usuarioId, modulos],
  );
  return { notificaciones: rows, sinLeer: sinLeer[0].n };
}

/**
 * Avisos nuevos de cada módulo (por la ruta a la que llevan), para las
 * burbujas del menú lateral: { '/admin/abonos': 2, … }. Cuenta los que
 * llegaron después de la última vez que el usuario entró a ese módulo (o,
 * si nunca entró, desde que abrió la campana por última vez).
 */
export async function porRuta(usuarioId, modulos) {
  const { rows } = await query(
    `SELECT n.enlace AS ruta, COUNT(*)::int AS n
       FROM notificacion_personal n
       JOIN usuario u ON u.id = $1
       LEFT JOIN notificacion_vista_ruta v ON v.usuario_id = u.id AND v.ruta = n.enlace
      WHERE n.modulo = ANY($2) AND n.enlace IS NOT NULL
        AND n.creado_en > COALESCE(v.visto_en, u.notificaciones_vistas_en)
        AND NOT EXISTS (SELECT 1 FROM notificacion_personal_borrada b WHERE b.usuario_id = u.id AND b.notificacion_id = n.id)
      GROUP BY n.enlace`,
    [usuarioId, modulos],
  );
  return Object.fromEntries(rows.map((r) => [r.ruta, r.n]));
}

/** El usuario entró al módulo: su burbuja vuelve a cero. */
export async function marcarRutaVista(usuarioId, ruta) {
  await query(
    `INSERT INTO notificacion_vista_ruta (usuario_id, ruta) VALUES ($1, $2)
     ON CONFLICT (usuario_id, ruta) DO UPDATE SET visto_en = now()`,
    [usuarioId, ruta],
  );
}

/**
 * El usuario borra un aviso (o todos los que ve, si `id` es null). Como los
 * avisos del personal son compartidos, solo dejan de verse para él.
 * Devuelve cuántos borró.
 */
export async function borrar(usuarioId, modulos, id = null) {
  const { rowCount } = await query(
    `INSERT INTO notificacion_personal_borrada (usuario_id, notificacion_id)
     SELECT $1, n.id FROM notificacion_personal n
      WHERE n.modulo = ANY($2) AND ($3::bigint IS NULL OR n.id = $3)
     ON CONFLICT DO NOTHING`,
    [usuarioId, modulos, id],
  );
  return rowCount;
}

/** Marca como vistos todos los avisos hasta este momento. */
export async function marcarLeidas(usuarioId) {
  await query('UPDATE usuario SET notificaciones_vistas_en = now() WHERE id = $1', [usuarioId]);
}
