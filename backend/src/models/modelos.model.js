import { query } from '../db.js';
import { actualizarCampos, POOL } from './listado.model.js';

/**
 * Modelo de los modelos de llanta (tablas `modelo_llanta` y `modelo_imagen`).
 *
 * Un modelo es la llanta como producto: marca, nombre, categoría, tipo de
 * vehículo, su ficha técnica y sus fotos. Cada medida que se vende es una
 * referencia (una fila de `producto`, ver productos.model.js). Lo que se
 * cambia aquí la base lo copia a todas sus referencias (migración 0040).
 *
 * La ficha técnica se copia a mano desde la página del fabricante o del
 * proveedor; `fuenteFicha` dice de dónde.
 */

/** Nombres de la API → columnas de modelo_llanta que se pueden editar. */
export const COLUMNAS = {
  nombre: 'nombre',
  descripcion: 'descripcion',
  categoriaId: 'categoria_id',
  marcaId: 'marca_id',
  tipoVehiculoId: 'tipo_vehiculo_id',
  activo: 'activo',
  // Ficha técnica
  uso: 'uso',
  posicion: 'posicion',
  labrado: 'labrado',
  construccion: 'construccion',
  sinCamara: 'sin_camara',
  garantiaMeses: 'garantia_meses',
  paisOrigen: 'pais_origen',
  recauchable: 'recauchable',
  fuenteFicha: 'fuente_ficha',
};

const SELECCION = `
  ml.id, ml.nombre, ml.descripcion,
  ml.categoria_id AS "categoriaId", c.nombre AS categoria, c.color AS "colorCategoria",
  ml.marca_id AS "marcaId", m.nombre AS marca,
  ml.tipo_vehiculo_id AS "tipoVehiculoId", tv.nombre AS "tipoVehiculo",
  ml.uso, ml.posicion, ml.labrado, ml.construccion, ml.sin_camara AS "sinCamara",
  ml.garantia_meses AS "garantiaMeses", ml.pais_origen AS "paisOrigen", ml.recauchable,
  ml.fuente_ficha AS "fuenteFicha", ml.activo, ml.creado_en AS "creadoEn",
  (SELECT count(*)::int FROM producto p WHERE p.modelo_id = ml.id) AS "totalReferencias",
  (SELECT count(*)::int FROM producto p WHERE p.modelo_id = ml.id AND p.activo) AS "referenciasActivas",
  -- Las llantas reencauchadas (unidades únicas) cuelgan de su propio modelo
  EXISTS (SELECT 1 FROM producto p WHERE p.modelo_id = ml.id AND p.reencauchada) AS "deReencauchadas",
  (SELECT string_agg(p.medidas, ', ' ORDER BY p.rin NULLS LAST, p.ancho NULLS LAST, p.medidas)
     FROM producto p WHERE p.modelo_id = ml.id AND NOT p.reencauchada) AS medidas,
  (SELECT mi.url FROM modelo_imagen mi WHERE mi.modelo_id = ml.id ORDER BY mi.orden, mi.id LIMIT 1) AS foto`;

const DESDE = `
  FROM modelo_llanta ml
  JOIN categoria c ON c.id = ml.categoria_id
  JOIN marca m ON m.id = ml.marca_id
  LEFT JOIN tipo_vehiculo tv ON tv.id = ml.tipo_vehiculo_id`;

/**
 * Listado con búsqueda (nombre, marca, medida, código o código del
 * fabricante de alguna referencia), filtros y paginación → { filas, total }.
 */
export async function listar({ q, pagina, porPagina, activo, categoriaId, marcaId, tipoVehiculoId }) {
  const condiciones = [];
  const valores = [];
  const agregar = (valor, armar) => {
    valores.push(valor);
    condiciones.push(armar(`$${valores.length}`));
  };

  if (q) {
    agregar(
      `%${q}%`,
      (p) => `(ml.nombre ILIKE ${p} OR m.nombre ILIKE ${p} OR EXISTS (
         SELECT 1 FROM producto r WHERE r.modelo_id = ml.id
            AND (r.medidas ILIKE ${p} OR r.codigo ILIKE ${p} OR r.codigo_fabricante ILIKE ${p})))`,
    );
  }
  if (activo !== undefined) agregar(activo, (p) => `ml.activo = ${p}`);
  if (categoriaId) agregar(categoriaId, (p) => `ml.categoria_id = ${p}`);
  if (marcaId) agregar(marcaId, (p) => `ml.marca_id = ${p}`);
  if (tipoVehiculoId) agregar(tipoVehiculoId, (p) => `ml.tipo_vehiculo_id = ${p}`);

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const total = await query(`SELECT COUNT(*)::int AS n ${DESDE} ${where}`, valores);
  const { rows } = await query(
    `SELECT ${SELECCION} ${DESDE} ${where}
      ORDER BY m.nombre, ml.nombre, ml.id
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );
  return { filas: rows, total: total.rows[0].n };
}

/** Un modelo por id, o null. */
export async function buscarPorId(id, db = POOL) {
  const { rows } = await db.query(`SELECT ${SELECCION} ${DESDE} WHERE ml.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Fotos del modelo, en orden. */
export async function imagenes(modeloId, db = POOL) {
  const { rows } = await db.query('SELECT id, url, orden FROM modelo_imagen WHERE modelo_id = $1 ORDER BY orden, id', [
    modeloId,
  ]);
  return rows;
}

/** Crea un modelo con su ficha técnica y devuelve su id. */
export async function crear(db, datos) {
  const pares = Object.entries(COLUMNAS)
    .filter(([campo]) => datos[campo] !== undefined)
    .map(([campo, columna]) => [columna, datos[campo]]);
  const { rows } = await db.query(
    `INSERT INTO modelo_llanta (${pares.map(([c]) => c).join(', ')})
     VALUES (${pares.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    pares.map(([, v]) => v),
  );
  return rows[0].id;
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. La base propaga a sus referencias. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'modelo_llanta', id, pares);
}

/** Reemplaza la foto principal del modelo (o la quita si es null). */
export async function guardarFoto(db, modeloId, foto) {
  if (foto === undefined) return;
  await db.query('DELETE FROM modelo_imagen WHERE modelo_id = $1', [modeloId]);
  if (foto) await db.query('INSERT INTO modelo_imagen (modelo_id, url) VALUES ($1, $2)', [modeloId, foto]);
}

/** ¿Esta referencia (producto) pertenece al modelo? Devuelve su fila mínima o null. */
export async function referenciaDe(db, modeloId, referenciaId) {
  const { rows } = await db.query('SELECT id, reencauchada, activo FROM producto WHERE id = $1 AND modelo_id = $2', [
    referenciaId,
    modeloId,
  ]);
  return rows[0] ?? null;
}
