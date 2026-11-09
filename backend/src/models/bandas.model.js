import { query } from '../db.js';
import { actualizarCampos, aPares, consultarListado, POOL } from './listado.model.js';

/**
 * Modelo de las bandas de reencauche (tablas `banda` y `banda_medida`).
 *
 * Una banda se elige por diseño, tipo de vehículo y ancho, y guarda las
 * medidas de llanta con las que es compatible: así el cliente la encuentra
 * por la medida de su llanta y el asesor solo puede asignarla a una llanta
 * de esas medidas.
 */

/** Nombres de la API → columnas que se pueden escribir. */
export const COLUMNAS = {
  nombre: 'nombre',
  diseno: 'diseno',
  tipoVehiculoId: 'tipo_vehiculo_id',
  anchoMm: 'ancho_mm',
  profundidadMm: 'profundidad_mm',
  precio: 'precio',
  activo: 'activo',
};

const MEDIDAS = `COALESCE((SELECT array_agg(m.medida ORDER BY m.medida) FROM banda_medida m WHERE m.banda_id = b.id), '{}') AS medidas`;

/** Columnas comunes del personal y del portal (sin el precio). */
const SELECT_PUBLICO = `
  b.id, b.codigo, b.nombre, b.diseno, d.descripcion AS "disenoDescripcion",
  b.tipo_vehiculo_id AS "tipoVehiculoId", tv.nombre AS "tipoVehiculo",
  b.ancho_mm AS "anchoMm", b.profundidad_mm AS "profundidadMm", b.activo,
  ${MEDIDAS}`;

/** El personal ve además el precio de la banda. */
const SELECT = `${SELECT_PUBLICO}, b.precio`;

const DESDE = `
  FROM banda b
  JOIN diseno_banda d ON d.nombre = b.diseno
  JOIN tipo_vehiculo tv ON tv.id = b.tipo_vehiculo_id`;

/** Listado del personal con búsqueda, filtro ?activo= y paginación → { filas, total } */
export function listar(parametros) {
  return consultarListado(
    {
      select: SELECT,
      desde: DESDE,
      buscarEn: ['b.codigo', 'b.nombre', 'b.diseno', 'tv.nombre'],
      filtros: { activo: 'b.activo' },
      orden: 'tv.nombre, d.orden, b.ancho_mm, b.nombre',
    },
    parametros,
  );
}

/** Una banda por id (con precio), o null. */
export async function buscarPorId(id, db = POOL) {
  const { rows } = await db.query(`SELECT ${SELECT} ${DESDE} WHERE b.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Bandas que se ofrecen en el portal: activas y sin precio. */
export async function activasParaPortal() {
  const { rows } = await query(
    `SELECT ${SELECT_PUBLICO} ${DESDE} WHERE b.activo ORDER BY tv.nombre, d.orden, b.ancho_mm, b.nombre`,
  );
  return rows;
}

/** Cambia las medidas compatibles de una banda por las indicadas. */
async function guardarMedidas(db, bandaId, medidas) {
  await db.query('DELETE FROM banda_medida WHERE banda_id = $1', [bandaId]);
  await db.query('INSERT INTO banda_medida (banda_id, medida) SELECT $1, unnest($2::text[])', [bandaId, medidas]);
}

/** Crea una banda con sus medidas y devuelve su id. El código lo pone la base. */
export async function crear(db, { medidas, ...datos }) {
  const pares = aPares(datos, COLUMNAS);
  const { rows } = await db.query(
    `INSERT INTO banda (${pares.map(([c]) => c).join(', ')})
     VALUES (${pares.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING id`,
    pares.map(([, v]) => v),
  );
  await guardarMedidas(db, rows[0].id, medidas);
  return rows[0].id;
}

/** Actualiza lo que llegó; devuelve false si la banda no existe. */
export async function actualizar(db, id, { medidas, ...datos }) {
  const { rows } = await db.query('SELECT id FROM banda WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) return false;
  await actualizarCampos(db, 'banda', id, aPares(datos, COLUMNAS));
  if (medidas) await guardarMedidas(db, id, medidas);
  return true;
}

/** Elimina; devuelve true si existía. Si un reencauche la usa, la base lo impide (409). */
export async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM banda WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Bandas indicadas con lo que necesita la revisión: si está activa, su
 * precio y sus medidas. Devuelve un Map id → banda.
 */
export async function paraRevision(db, ids) {
  const { rows } = await db.query(
    `SELECT b.id, b.nombre, b.activo, b.precio, ${MEDIDAS} FROM banda b WHERE b.id = ANY($1::int[])`,
    [ids],
  );
  return new Map(rows.map((b) => [b.id, b]));
}
