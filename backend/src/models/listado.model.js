import { query } from '../db.js';
import { noEncontrado } from '../errores.js';

/**
 * Consultas compartidas por los modelos de documentos (cotizaciones,
 * ventas, compras…). Solo hablan con la base de datos: no saben nada de
 * peticiones HTTP.
 *
 * Todas reciben al final una conexión `db` opcional: si se pasa la de una
 * transacción, la consulta corre dentro de ella; si no, usa el pool.
 */

/** Conexión por defecto: el pool compartido. */
export const POOL = { query };

/** Columnas de una línea de detalle (cotización o venta), con alias `d` y `p`. */
export const SELECT_LINEA = `
  d.id, d.tipo, d.producto_id AS "productoId", d.servicio_id AS "servicioId",
  p.codigo AS "codigoProducto", d.descripcion, d.medida, d.cantidad,
  d.precio_unitario AS "precioUnitario", d.subtotal`;

/**
 * Listado con búsqueda, filtros exactos y paginación.
 *
 * definicion:
 *   select          columnas, ya con sus alias camelCase
 *   desde           FROM + JOINs
 *   buscarEn        columnas donde busca `q`
 *   filtros         { nombreFiltro: 'columna' } con igualdad exacta
 *   columnaCliente  columna que liga el documento a un cliente
 *   orden           ORDER BY
 *
 * parametros: { q, pagina, porPagina, clienteId, ...valoresDeFiltros }
 *   clienteId  si llega, solo se devuelven los documentos de ese cliente
 *
 * Devuelve { filas, total }.
 */
export async function consultarListado(definicion, parametros, db = POOL) {
  const { select, desde, buscarEn, filtros = {}, columnaCliente, orden } = definicion;
  const { q, pagina, porPagina, clienteId, ...valoresFiltro } = parametros;

  const condiciones = [];
  const valores = [];
  // `armar` recibe el marcador ($1, $2…) que le tocó al valor
  const agregar = (valor, armar) => {
    valores.push(valor);
    condiciones.push(armar(`$${valores.length}`));
  };

  if (q) agregar(`%${q}%`, (p) => `(${buscarEn.map((c) => `${c} ILIKE ${p}`).join(' OR ')})`);
  for (const [nombre, columna] of Object.entries(filtros)) {
    if (valoresFiltro[nombre]) agregar(valoresFiltro[nombre], (p) => `${columna}::text = ${p}`);
  }
  if (clienteId && columnaCliente) agregar(clienteId, (p) => `${columnaCliente} = ${p}`);

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const total = await db.query(`SELECT COUNT(*)::int AS n ${desde} ${where}`, valores);
  const { rows } = await db.query(
    `SELECT ${select} ${desde} ${where} ORDER BY ${orden}
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );
  return { filas: rows, total: total.rows[0].n };
}

/**
 * Busca un documento por su número (PED-2024-001…).
 *
 *   clienteId  si llega, el documento debe ser de ese cliente; si es de
 *              otro se responde 404 (no 403) para no revelar qué existe
 *   bloquear   alias de la tabla a bloquear con FOR UPDATE (p. ej. 'c'):
 *              así dos personas no cambian el mismo documento a la vez.
 *              Solo tiene sentido dentro de una transacción.
 *   que        nombre para el mensaje de error ("La cotización")
 */
export async function consultarPorNumero(definicion, numero, { clienteId, bloquear, que }, db = POOL) {
  const { select, desde, columnaNumero, columnaCliente } = definicion;
  const valores = [numero];
  let filtroCliente = '';
  if (clienteId && columnaCliente) {
    valores.push(clienteId);
    filtroCliente = `AND ${columnaCliente} = $2`;
  }
  const bloqueo = bloquear ? `FOR UPDATE OF ${bloquear}` : '';
  const { rows } = await db.query(
    `SELECT ${select} ${desde} WHERE ${columnaNumero} = $1 ${filtroCliente} ${bloqueo}`,
    valores,
  );
  if (!rows[0]) throw noEncontrado(que);
  return rows[0];
}

/**
 * Arma un UPDATE con solo los campos que llegaron.
 *
 *   pares  [['columna', valor], …]
 *
 * Ejemplo: actualizarCampos(db, 'producto', 5, [['nombre', 'X']])
 * Si no hay nada que cambiar, no consulta. Devuelve cuántas filas cambió.
 */
export async function actualizarCampos(db, tabla, id, pares) {
  if (!pares.length) return 0;
  const { rowCount } = await db.query(
    `UPDATE ${tabla} SET ${pares.map(([columna], i) => `${columna} = $${i + 1}`).join(', ')}
      WHERE id = $${pares.length + 1}`,
    [...pares.map(([, valor]) => valor), id],
  );
  return rowCount;
}

/**
 * Convierte { campoApi: valor } en pares [columna, valor] según un mapa de
 * nombres { campoApi: 'columna_sql' }. Ignora los campos que no vinieron.
 */
export function aPares(datos, columnas) {
  return Object.entries(datos)
    .filter(([campo, valor]) => valor !== undefined && campo in columnas)
    .map(([campo, valor]) => [columnas[campo], valor]);
}

/**
 * ¿El registro está activo? Devuelve true, false o null si no existe.
 * `tabla` siempre viene del código (cliente, categoria…), nunca de la petición.
 */
export async function estaActivo(db, tabla, id) {
  const { rows } = await db.query(`SELECT activo FROM ${tabla} WHERE id = $1`, [id]);
  return rows[0] ? rows[0].activo : null;
}
