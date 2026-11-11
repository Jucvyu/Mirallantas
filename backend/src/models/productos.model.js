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
  // Solo la llanta reencauchada lleva precio fijo en el producto
  precioVenta: 'precio_venta',
};

/** Marca y categoría con las que entra al catálogo una llanta reencauchada. */
export const MARCA_REENCAUCHADA = 'Sin marca';
export const CATEGORIA_REENCAUCHADA = 'Reencauchadas';

/**
 * ¿La llanta reencauchada ya la pidió alguien? Es una sola unidad: queda
 * apartada mientras su cotización siga viva (no rechazada ni vencida sin
 * aceptar). Si esa cotización se cancela o vence, vuelve al catálogo.
 */
export const RESERVADA = `EXISTS (
    SELECT 1 FROM cotizacion_detalle rd JOIN cotizacion rc ON rc.id = rd.cotizacion_id
     WHERE rd.producto_id = p.id AND rc.estado <> 'Rechazada'
       AND NOT (rc.metodo_pago IS NULL AND rc.vence_en IS NOT NULL AND rc.vence_en < CURRENT_DATE))`;

/** Se puede pedir: activo y, si es reencauchada, con precio y sin apartar. */
const DISPONIBLE = `(p.activo AND (NOT p.reencauchada OR (p.precio_venta > 0 AND NOT ${RESERVADA})))`;

const SELECCION = `
  p.id, p.codigo, p.nombre, p.descripcion, p.medidas,
  p.categoria_id AS "categoriaId", c.nombre AS categoria,
  p.marca_id AS "marcaId", m.nombre AS marca,
  p.tipo_vehiculo_id AS "tipoVehiculoId", tv.nombre AS "tipoVehiculo",
  c.color AS "colorCategoria", p.activo,
  -- Llanta reencauchada: unidad única con precio fijo (el resto no lleva precio aquí)
  p.reencauchada, CASE WHEN p.reencauchada THEN p.precio_venta END AS "precioVenta",
  CASE WHEN p.reencauchada THEN ${RESERVADA} ELSE FALSE END AS reservada,
  ${DISPONIBLE} AS disponible, rl.identificador AS "llantaReencauche",
  (SELECT i.url FROM producto_imagen i WHERE i.producto_id = p.id ORDER BY i.orden, i.id LIMIT 1) AS foto`;

const DESDE = `
  FROM producto p
  JOIN categoria c ON c.id = p.categoria_id
  JOIN marca m ON m.id = p.marca_id
  LEFT JOIN tipo_vehiculo tv ON tv.id = p.tipo_vehiculo_id
  LEFT JOIN reencauche_llanta rl ON rl.producto_id = p.id`;

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
  // Lo que ve el cliente: lo que se puede pedir (una reencauchada apartada no sale)
  if (soloActivos) condiciones.push(DISPONIBLE);
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

/**
 * Datos de un producto que necesita la cotización (nombre, medida, precio
 * sugerido y estado). La fila queda bloqueada: así dos clientes no apartan
 * a la vez la misma llanta reencauchada.
 */
export async function paraCotizar(db, id) {
  const { rows } = await (db ?? POOL).query(
    `SELECT p.id, p.nombre, p.medidas, p.precio_venta, p.activo, p.reencauchada,
            CASE WHEN p.reencauchada THEN ${RESERVADA} ELSE FALSE END AS reservada
       FROM producto p WHERE p.id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * ¿Alguna llanta reencauchada de esta cotización ya la apartó otra
 * cotización viva? (p. ej. al volver a emitir una que venció). Devuelve el
 * nombre de la primera, o null.
 */
export async function reencauchadaOcupada(db, cotizacionId) {
  const { rows } = await db.query(
    `SELECT p.nombre, rl.identificador
       FROM cotizacion_detalle d
       JOIN producto p ON p.id = d.producto_id AND p.reencauchada
       LEFT JOIN reencauche_llanta rl ON rl.producto_id = p.id
      WHERE d.cotizacion_id = $1
        AND EXISTS (
          SELECT 1 FROM cotizacion_detalle rd JOIN cotizacion rc ON rc.id = rd.cotizacion_id
           WHERE rd.producto_id = p.id AND rc.id <> $1 AND rc.estado <> 'Rechazada'
             AND NOT (rc.metodo_pago IS NULL AND rc.vence_en IS NOT NULL AND rc.vence_en < CURRENT_DATE))
      LIMIT 1`,
    [cotizacionId],
  );
  if (!rows[0]) return null;
  return rows[0].identificador ? `${rows[0].nombre} (${rows[0].identificador})` : rows[0].nombre;
}

/** Id de una marca o categoría por nombre; la crea si no existe. */
async function idPorNombre(db, tabla, nombre) {
  const { rows } = await db.query(
    `INSERT INTO ${tabla} (nombre) VALUES ($1)
     ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [nombre],
  );
  return rows[0].id;
}

/**
 * Crea el producto de una llanta reencauchada que el cliente no pagó: sin
 * marca, en la categoría "Reencauchadas" y sin imagen. Sin precio queda
 * inactivo (no se ofrece) hasta que el personal se lo ponga. Devuelve el id.
 */
export async function crearReencauchada(db, { descripcion, medidas, tipoVehiculoId, precioVenta }) {
  const marcaId = await idPorNombre(db, 'marca', MARCA_REENCAUCHADA);
  const categoriaId = await idPorNombre(db, 'categoria', CATEGORIA_REENCAUCHADA);
  const { rows } = await db.query(
    `INSERT INTO producto (nombre, descripcion, categoria_id, marca_id, medidas, tipo_vehiculo_id,
                           precio_venta, activo, reencauchada)
     VALUES ('Llanta reencauchada', $1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id`,
    [descripcion, categoriaId, marcaId, medidas, tipoVehiculoId ?? null, precioVenta ?? 0, Boolean(precioVenta)],
  );
  return rows[0].id;
}

/** Guarda el último precio al que se compró el producto (costo interno). */
export async function actualizarPrecioCompra(db, productoId, precio) {
  await db.query('UPDATE producto SET precio_compra = $1 WHERE id = $2', [precio, productoId]);
}
