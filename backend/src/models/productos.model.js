import { query } from '../db.js';
import { actualizarCampos, POOL } from './listado.model.js';

/**
 * Modelo de productos (tablas `producto` y `producto_imagen`).
 */

/** Nombres de la API → columnas que se pueden editar. */
export const COLUMNAS_EDITABLES = {
  nombre: 'nombre',
  descripcion: 'descripcion',
  categoriaId: 'categoria_id',
  marcaId: 'marca_id',
  medidas: 'medidas',
  tipoVehiculoId: 'tipo_vehiculo_id',
  precioVenta: 'precio_venta',
  activo: 'activo',
};

/**
 * Rango de precio orientativo para el catálogo del cliente: el menor y el
 * mayor entre el precio de venta actual y los precios a los que se vendió o
 * se cotizó formalmente la llanta en los últimos 180 días. Son precios de
 * venta reales; el costo del proveedor nunca entra en la cuenta.
 */
const RANGO_PRECIO = `
  LEFT JOIN LATERAL (
    SELECT MIN(r.valor) AS minimo, MAX(r.valor) AS maximo
      FROM (
        SELECT p.precio_venta AS valor
        UNION ALL
        SELECT vd.precio_unitario FROM venta_detalle vd JOIN venta ve ON ve.id = vd.venta_id
         WHERE vd.producto_id = p.id AND ve.estado <> 'Anulada' AND ve.fecha >= CURRENT_DATE - 180
        UNION ALL
        SELECT cd.precio_unitario FROM cotizacion_detalle cd JOIN cotizacion co ON co.id = cd.cotizacion_id
         WHERE cd.producto_id = p.id AND co.emitida_en >= CURRENT_DATE - 180 AND cd.precio_unitario IS NOT NULL
      ) r
     WHERE r.valor > 0
  ) rango ON TRUE`;

const SELECCION = `
  p.id, p.codigo, p.nombre, p.descripcion, p.medidas,
  p.categoria_id AS "categoriaId", c.nombre AS categoria,
  p.marca_id AS "marcaId", m.nombre AS marca,
  p.tipo_vehiculo_id AS "tipoVehiculoId", tv.nombre AS "tipoVehiculo",
  p.precio_compra AS "precioCompra", p.precio_venta AS "precioVenta",
  rango.minimo AS "precioMinimo", rango.maximo AS "precioMaximo",
  p.activo,
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
    `SELECT ${SELECCION} ${DESDE} ${RANGO_PRECIO} ${where}
      ORDER BY p.nombre, p.id
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );
  return { filas: rows, total: total.rows[0].n };
}

/** Un producto por id, o null. */
export async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${SELECCION} ${DESDE} ${RANGO_PRECIO} WHERE p.id = $1`, [id]);
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
 * Crea un producto (sin precio de compra) y devuelve su id. El código no se
 * envía: lo genera la base (ML-000001…) y la restricción UNIQUE lo protege
 * aunque dos asesores creen productos al mismo tiempo.
 */
export async function crear(db, p) {
  const { rows } = await db.query(
    `INSERT INTO producto (nombre, descripcion, categoria_id, marca_id, medidas, tipo_vehiculo_id, precio_venta)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [p.nombre, p.descripcion ?? null, p.categoriaId, p.marcaId, p.medidas, p.tipoVehiculoId ?? null, p.precioVenta],
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
