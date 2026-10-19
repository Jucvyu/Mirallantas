/**
 * Consultas de la tabla `servicio` que usan otros módulos. El CRUD del
 * catálogo de servicios lo hace el modelo genérico (catalogos.model.js).
 */

/**
 * Servicio para una línea de cotización: por id o, si no se indica, por
 * nombre (el servicio por defecto). Devuelve null si no existe.
 */
export async function paraCotizar(db, { id, nombre }) {
  const { rows } = id
    ? await db.query('SELECT id, nombre, precio, activo FROM servicio WHERE id = $1', [id])
    : await db.query('SELECT id, nombre, precio, activo FROM servicio WHERE nombre = $1', [nombre]);
  return rows[0] ?? null;
}
