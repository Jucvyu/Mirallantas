import { query } from '../db.js';
import { actualizarCampos, POOL } from './listado.model.js';

/**
 * Modelo de productos (tablas `producto` y `producto_imagen`).
 *
 * El catálogo y la gestión de productos no muestran precios: las consultas
 * de este modelo no los devuelven. Las columnas precio_venta y
 * precio_compra se conservan en la base porque las usan las operaciones
 * comerciales (precio sugerido al emitir una cotización, último costo de
 * compra), que los leen con sus propias consultas.
 */

/** Nombres de la API → columnas que se pueden editar. */
export const COLUMNAS_EDITABLES = {
  nombre: 'nombre',
  descripcion: 'descripcion',
  categoriaId: 'categoria_id',
  marcaId: 'marca_id',
  medidas: 'medidas',
  tipoVehiculoId: 'tipo_vehiculo_id',
  activo: 'activo',
};

const SELECCION = `
  p.id, p.codigo, p.nombre, p.descripcion, p.medidas,
  p.categoria_id AS "categoriaId", c.nombre AS categoria,
  p.marca_id AS "marcaId", m.nombre AS marca,
  p.tipo_vehiculo_id AS "tipoVehiculoId", tv.nombre AS "tipoVehiculo",
  c.color AS "colorCategoria", p.activo,
  (SELECT i.url FROM producto_imagen i WHERE i.producto_id = p.id ORDER BY i.orden, i.id LIMIT 1) AS foto`;

const DESDE = `
  FROM producto p
  JOIN categoria c ON c.id = p.categoria_id
  JOIN marca m ON m.id = p.marca_id
  LEFT JOIN tipo_vehiculo tv ON tv.id = p.tipo_vehiculo_id`;

/**
 * Catálogo con búsqueda, filtros y paginación → { filas, total }.
 * `soloActivos` = true limita a los productos que se están vendiendo.
 */
export async function listar({ q, pagina, porPagina, activo, soloActivos, categoriaId, marcaId, tipoVehiculoId }) {
  const condiciones = [];
  const valores = [];
  // `armar` recibe el marcador ($1, $2…) asignado al valor
  const agregar = (valor, armar) => {
    valores.push(valor);
    condiciones.push(armar(`$${valores.length}`));
  };

  if (q) {
    agregar(`%${q}%`, (p) => `(p.nombre ILIKE ${p} OR p.codigo ILIKE ${p} OR p.medidas ILIKE ${p} OR m.nombre ILIKE ${p})`);
  }
  if (soloActivos) agregar(true, (p) => `p.activo = ${p}`);
  else if (activo !== undefined) agregar(activo, (p) => `p.activo = ${p}`);
  if (categoriaId) agregar(categoriaId, (p) => `p.categoria_id = ${p}`);
  if (marcaId) agregar(marcaId, (p) => `p.marca_id = ${p}`);
  if (tipoVehiculoId) agregar(tipoVehiculoId, (p) => `p.tipo_vehiculo_id = ${p}`);

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const total = await query(`SELECT COUNT(*)::int AS n ${DESDE} ${where}`, valores);
  const { rows } = await query(
    `SELECT ${SELECCION} ${DESDE} ${where}
      ORDER BY p.nombre, p.id
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );
  return { filas: rows, total: total.rows[0].n };
}

/** Un producto por id, o null. */
export async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${SELECCION} ${DESDE} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Imágenes de un producto, en orden. */
export async function imagenes(productoId) {
  const { rows } = await query('SELECT id, url, orden FROM producto_imagen WHERE producto_id = $1 ORDER BY orden, id', [
    productoId,
  ]);
  return rows;
}

/**
 * Crea un producto y devuelve su id. El código no se envía: lo genera la
 * base (ML-000001…) y la restricción UNIQUE lo protege aunque dos asesores
 * creen productos al mismo tiempo. No lleva precio: el de venta se define
 * en cada cotización y el de compra en cada compra.
 */
export async function crear(db, p) {
  const { rows } = await db.query(
    `INSERT INTO producto (nombre, descripcion, categoria_id, marca_id, medidas, tipo_vehiculo_id, precio_venta)
     VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING id`,
    [p.nombre, p.descripcion ?? null, p.categoriaId, p.marcaId, p.medidas, p.tipoVehiculoId ?? null],
  );
  return rows[0].id;
}

/** Medidas registradas en el catálogo, sin repetir (para el buscador de medidas). */
export async function medidas() {
  const { rows } = await query('SELECT DISTINCT medidas FROM producto ORDER BY medidas');
  return rows.map((r) => r.medidas);
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'producto', id, pares);
}

/** Reemplaza la foto principal del producto (o la quita si es null). */
export async function guardarFoto(db, productoId, foto) {
  if (foto === undefined) return;
  await db.query('DELETE FROM producto_imagen WHERE producto_id = $1', [productoId]);
  if (foto) await db.query('INSERT INTO producto_imagen (producto_id, url) VALUES ($1, $2)', [productoId, foto]);
}

/** Datos de un producto que necesita la cotización (nombre, medida, precio sugerido y estado). */
export async function paraCotizar(db, id) {
  const { rows } = await (db ?? POOL).query('SELECT id, nombre, medidas, precio_venta, activo FROM producto WHERE id = $1', [
    id,
  ]);
  return rows[0] ?? null;
}

/** Guarda el último precio al que se compró el producto (costo interno). */
export async function actualizarPrecioCompra(db, productoId, precio) {
  await db.query('UPDATE producto SET precio_compra = $1 WHERE id = $2', [precio, productoId]);
}
