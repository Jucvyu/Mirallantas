import { query } from '../db.js';
import { POOL } from './listado.model.js';

/**
 * Modelo de roles y permisos (tablas `rol`, `permiso` y `rol_permiso`).
 */

/** Rol que siempre debe existir para no dejar el sistema sin administrador. */
export const ROL_ADMIN = 'Administrador';
/** Rol de las cuentas del portal: cada una queda ligada a un cliente. */
export const ROL_CLIENTE = 'Cliente';

/** Roles con sus permisos (como lista de módulos). Si se pasa `id`, solo ese. */
export async function listar(id) {
  const { rows } = await query(
    `SELECT r.id, r.nombre, r.descripcion, r.activo,
            COALESCE(array_agg(p.modulo ORDER BY p.id) FILTER (WHERE p.modulo IS NOT NULL), '{}') AS permisos,
            COALESCE(json_object_agg(p.modulo, json_build_object('crear', rp.puede_crear, 'editar', rp.puede_editar, 'eliminar', rp.puede_eliminar))
              FILTER (WHERE p.modulo IS NOT NULL), '{}') AS privilegios
       FROM rol r
       LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
       LEFT JOIN permiso p ON p.id = rp.permiso_id
      ${id ? 'WHERE r.id = $1' : ''}
      GROUP BY r.id
      ORDER BY r.id`,
    id ? [id] : [],
  );
  return rows;
}

/** Un rol con sus permisos, o null. */
export async function buscarPorId(id) {
  return (await listar(id))[0] ?? null;
}

/** Todos los módulos que se pueden asignar a un rol. */
export async function listarPermisos() {
  const { rows } = await query('SELECT id, modulo FROM permiso ORDER BY id');
  return rows;
}

/** Permisos (id y módulo) que corresponden a esos nombres de módulo. */
export async function permisosPorModulo(db, modulos) {
  const { rows } = await db.query('SELECT id, modulo FROM permiso WHERE modulo = ANY($1)', [modulos]);
  return rows;
}

/** Crea un rol y devuelve su id. */
export async function crear(db, { nombre, descripcion, activo }) {
  const { rows } = await db.query('INSERT INTO rol (nombre, descripcion, activo) VALUES ($1, $2, $3) RETURNING id', [
    nombre,
    descripcion ?? null,
    activo ?? true,
  ]);
  return rows[0].id;
}

/** Actualiza nombre, descripción o estado; lo que llegue null no cambia. */
export async function actualizar(db, id, { nombre, descripcion, activo }) {
  await db.query(
    `UPDATE rol SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion),
                    activo = COALESCE($3, activo)
      WHERE id = $4`,
    [nombre ?? null, descripcion ?? null, activo ?? null, id],
  );
}

/**
 * Reemplaza los permisos del rol: [{ id, crear, editar, eliminar }] (id de
 * `permiso` y sus privilegios; los que falten quedan en true).
 */
export async function reemplazarPermisos(db, rolId, permisos) {
  await db.query('DELETE FROM rol_permiso WHERE rol_id = $1', [rolId]);
  for (const { id, crear = true, editar = true, eliminar = true } of permisos) {
    await db.query(
      `INSERT INTO rol_permiso (rol_id, permiso_id, puede_crear, puede_editar, puede_eliminar)
       VALUES ($1, $2, $3, $4, $5)`,
      [rolId, id, crear, editar, eliminar],
    );
  }
}

/** Elimina un rol. Si hay usuarios con él, la base lo impide (409). */
export async function eliminar(id, db = POOL) {
  await db.query('DELETE FROM rol WHERE id = $1', [id]);
}

/** Nombre de un rol por su id, o null si no existe. */
export async function nombrePorId(db, id) {
  const { rows } = await db.query('SELECT nombre FROM rol WHERE id = $1', [id]);
  return rows[0]?.nombre ?? null;
}

/** Id de un rol por su nombre. */
export async function idPorNombre(db, nombre) {
  const { rows } = await db.query('SELECT id FROM rol WHERE nombre = $1', [nombre]);
  return rows[0]?.id ?? null;
}
