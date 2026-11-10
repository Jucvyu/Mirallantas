import { query } from '../db.js';
import { actualizarCampos, consultarListado, POOL } from './listado.model.js';

/**
 * Modelo del reencauche por banda (tablas `reencauche` y `reencauche_llanta`).
 *
 *   reencauche          la solicitud: banda pedida, medida, cantidad y dónde
 *                       se revisan las llantas, con su estado.
 *   reencauche_llanta   cada llanta revisada. Las aptas llevan banda y valor
 *                       y, cuando el cliente acepta, son la orden de
 *                       reencauche en la planta (columna `estado`).
 */

/** Nombres de la API → columnas que se pueden escribir en la solicitud. */
export const COLUMNAS = {
  fechaRevision: 'fecha_revision',
  estado: 'estado',
  cantidad: 'cantidad',
  motivoCancelacion: 'motivo_cancelacion',
};

// Resumen de las llantas de cada solicitud: cuántas sirven y cuánto vale.
// Lo rechazado en la planta no cuenta en el valor: no se cobra.
const RESUMEN = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS revisadas,
           COUNT(*) FILTER (WHERE l.resultado = 'Apta')::int AS aptas,
           COUNT(*) FILTER (WHERE l.resultado = 'No apta')::int AS no_aptas,
           COUNT(*) FILTER (WHERE l.estado = 'Entregada')::int AS entregadas,
           COUNT(*) FILTER (WHERE l.estado = 'Rechazada en planta')::int AS rechazadas_planta,
           COUNT(*) FILTER (WHERE l.estado IN ('Por enviar', 'En planta', 'Lista para entregar'))::int AS en_proceso,
           COUNT(*) FILTER (WHERE l.estado = 'Lista para entregar')::int AS listas,
           COALESCE(SUM(l.precio_banda + l.mano_obra)
             FILTER (WHERE l.resultado = 'Apta' AND l.estado IS DISTINCT FROM 'Rechazada en planta'), 0) AS valor,
           COALESCE(SUM(l.precio_banda + l.mano_obra) FILTER (WHERE l.estado = 'Entregada'), 0) AS cobrado
      FROM reencauche_llanta l WHERE l.reencauche_id = r.id
  ) ll ON TRUE`;

const SELECT_SOLICITUD = `
  r.id, r.numero, r.cliente_id AS "clienteId", cl.nombre_completo AS cliente, cl.telefono AS "telefonoCliente",
  r.banda_id AS "bandaId", b.nombre AS banda, b.diseno, b.ancho_mm AS "anchoMm",
  r.medida, r.cantidad, r.lugar, r.direccion, r.fecha_preferida AS "fechaPreferida",
  r.fecha_revision AS "fechaRevision", r.notas, r.estado, r.motivo_cancelacion AS "motivoCancelacion",
  r.revisado_en AS "revisadoEn", r.respondido_en AS "respondidoEn", r.creado_en AS "creadoEn",
  ll.revisadas, ll.aptas, ll.no_aptas AS "noAptas", ll.entregadas, ll.rechazadas_planta AS "rechazadasPlanta",
  ll.en_proceso AS "enProceso", ll.listas, ll.valor, ll.cobrado`;

const DESDE_SOLICITUD = `
  FROM reencauche r
  JOIN cliente cl ON cl.id = r.cliente_id
  JOIN banda b ON b.id = r.banda_id
  ${RESUMEN}`;

const SELECT_LLANTA = `
  l.id, l.reencauche_id AS "reencaucheId", l.posicion, l.identificador, l.medida,
  l.reencauches_previos AS "reencauchesPrevios", l.resultado, l.motivo_no_apta AS "motivoNoApta",
  l.banda_id AS "bandaId", lb.nombre AS banda, lb.diseno, lb.ancho_mm AS "anchoMm",
  l.precio_banda AS "precioBanda", l.mano_obra AS "manoObra",
  COALESCE(l.precio_banda, 0) + COALESCE(l.mano_obra, 0) AS valor,
  l.estado, l.tercero_id AS "terceroId", t.nombre_razon_social AS tercero, l.enviada_en AS "enviadaEn",
  l.motivo_planta AS "motivoPlanta", l.pago_medio AS "pagoMedio", l.pago_fecha AS "pagoFecha",
  l.pago_comprobante AS "pagoComprobante"`;

const DESDE_LLANTA = `
  FROM reencauche_llanta l
  LEFT JOIN banda lb ON lb.id = l.banda_id
  LEFT JOIN tercero t ON t.id = l.tercero_id`;

/** Las llantas de varias solicitudes, agrupadas por solicitud → Map id → [llantas]. */
async function llantasDe(ids, db = POOL) {
  const grupos = new Map(ids.map((id) => [id, []]));
  if (ids.length === 0) return grupos;
  const { rows } = await db.query(
    `SELECT ${SELECT_LLANTA} ${DESDE_LLANTA} WHERE l.reencauche_id = ANY($1::int[]) ORDER BY l.posicion`,
    [ids],
  );
  for (const llanta of rows) grupos.get(llanta.reencaucheId).push(llanta);
  return grupos;
}

// Lo que necesita atención va primero: por agendar, agendadas y cotizadas
const ORDEN_SOLICITUDES = `
  CASE r.estado WHEN 'Por agendar' THEN 0 WHEN 'Agendada' THEN 1 WHEN 'Cotizada' THEN 2 WHEN 'Aceptada' THEN 3 ELSE 4 END,
  r.creado_en DESC, r.id DESC`;

/** Listado del personal con búsqueda, filtro ?estado= y paginación → { filas, total } */
export function listar(parametros) {
  return consultarListado(
    {
      select: SELECT_SOLICITUD,
      desde: DESDE_SOLICITUD,
      buscarEn: ['r.numero', 'cl.nombre_completo', 'b.nombre', 'r.medida'],
      filtros: { estado: 'r.estado' },
      columnaCliente: 'r.cliente_id',
      orden: ORDEN_SOLICITUDES,
    },
    parametros,
  );
}

/**
 * Una solicitud con sus llantas, o null. Con `clienteId`, solo si es de ese
 * cliente (otro cliente recibe null, igual que si no existiera).
 */
export async function detalle(numero, { clienteId } = {}, db = POOL) {
  const valores = [numero];
  if (clienteId) valores.push(clienteId);
  const { rows } = await db.query(
    `SELECT ${SELECT_SOLICITUD} ${DESDE_SOLICITUD} WHERE r.numero = $1 ${clienteId ? 'AND r.cliente_id = $2' : ''}`,
    valores,
  );
  if (!rows[0]) return null;
  const llantas = await llantasDe([rows[0].id], db);
  return { ...rows[0], llantas: llantas.get(rows[0].id) };
}

/** Las solicitudes de un cliente con sus llantas (portal), las más nuevas primero. */
export async function deCliente(clienteId) {
  const { rows } = await query(
    `SELECT ${SELECT_SOLICITUD} ${DESDE_SOLICITUD} WHERE r.cliente_id = $1 ORDER BY r.creado_en DESC, r.id DESC`,
    [clienteId],
  );
  const llantas = await llantasDe(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, llantas: llantas.get(r.id) }));
}

/** Crea una solicitud con su consecutivo (REE-AAAA-NNN) → { id, numero }. */
export async function crear(db, s) {
  const { rows } = await db.query(
    `INSERT INTO reencauche (numero, cliente_id, banda_id, medida, cantidad, lugar, direccion, fecha_preferida, notas)
     VALUES (siguiente_numero('REE'), $1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, numero`,
    [
      s.clienteId,
      s.bandaId,
      s.medida,
      s.cantidad,
      s.lugar,
      s.lugar === 'Cliente' ? s.direccion : null,
      s.fechaPreferida,
      s.notas ?? null,
    ],
  );
  return rows[0];
}

/**
 * Fila bloqueada (dentro de una transacción) con lo que necesitan las
 * reglas. Con `clienteId`, solo si es de ese cliente.
 */
export async function bloquear(db, numero, clienteId = null) {
  const { rows } = await db.query(
    `SELECT r.id, r.numero, r.estado, r.cliente_id, r.cantidad, r.fecha_revision, r.lugar, b.nombre AS banda
       FROM reencauche r JOIN banda b ON b.id = r.banda_id
      WHERE r.numero = $1 ${clienteId ? 'AND r.cliente_id = $2' : ''}
        FOR UPDATE OF r`,
    clienteId ? [numero, clienteId] : [numero],
  );
  return rows[0] ?? null;
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'reencauche', id, pares);
}

/** Marca la solicitud como revisada por el usuario indicado. */
export async function marcarRevisada(db, id, usuarioId, estado, cantidad) {
  await db.query(
    `UPDATE reencauche SET estado = $2, cantidad = $3, revisado_en = now(), revisado_por = $4 WHERE id = $1`,
    [id, estado, cantidad, usuarioId],
  );
}

/** Registra la respuesta del cliente a la cotización. */
export async function marcarRespondida(db, id, estado) {
  await db.query('UPDATE reencauche SET estado = $2, respondido_en = now() WHERE id = $1', [id, estado]);
}

/** Cambia las llantas revisadas de una solicitud por las indicadas (en su orden). */
export async function reemplazarLlantas(db, reencaucheId, llantas) {
  await db.query('DELETE FROM reencauche_llanta WHERE reencauche_id = $1', [reencaucheId]);
  for (const [i, l] of llantas.entries()) {
    const apta = l.resultado === 'Apta';
    await db.query(
      `INSERT INTO reencauche_llanta (reencauche_id, posicion, identificador, medida, reencauches_previos, resultado,
                                      motivo_no_apta, banda_id, precio_banda, mano_obra)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        reencaucheId,
        i + 1,
        l.identificador,
        l.medida,
        l.reencauchesPrevios ?? 0,
        l.resultado,
        apta ? null : l.motivoNoApta,
        apta ? l.bandaId : null,
        apta ? l.precioBanda : null,
        apta ? l.manoObra : null,
      ],
    );
  }
}

/** Al aceptar, cada llanta apta queda como orden "Por enviar". Devuelve cuántas. */
export async function abrirOrdenes(db, reencaucheId) {
  const { rowCount } = await db.query(
    `UPDATE reencauche_llanta SET estado = 'Por enviar' WHERE reencauche_id = $1 AND resultado = 'Apta'`,
    [reencaucheId],
  );
  return rowCount;
}

// ---- Órdenes en la reencauchadora ----------------------------------------------

const SELECT_ORDEN = `${SELECT_LLANTA}, r.numero AS reencauche, r.cliente_id AS "clienteId", cl.nombre_completo AS cliente`;

const DESDE_ORDEN = `${DESDE_LLANTA}
  JOIN reencauche r ON r.id = l.reencauche_id
  JOIN cliente cl ON cl.id = r.cliente_id`;

/** Listado de órdenes (llantas aceptadas) con búsqueda y filtro ?estado= → { filas, total } */
export function listarOrdenes(parametros) {
  return consultarListado(
    {
      select: SELECT_ORDEN,
      desde: `${DESDE_ORDEN}`,
      buscarEn: ['r.numero', 'cl.nombre_completo', 'l.identificador', 'lb.nombre', 't.nombre_razon_social'],
      // Solo las llantas que el cliente aceptó (las demás no tienen orden)
      filtros: { estado: 'l.estado', conOrden: "(l.estado IS NOT NULL)" },
      orden: `CASE l.estado WHEN 'Lista para entregar' THEN 0 WHEN 'Por enviar' THEN 1 WHEN 'En planta' THEN 2 ELSE 3 END,
              r.numero DESC, l.posicion`,
    },
    { ...parametros, conOrden: 'true' },
  );
}

/** Una orden por id, o null. */
export async function orden(id, db = POOL) {
  const { rows } = await db.query(`SELECT ${SELECT_ORDEN} ${DESDE_ORDEN} WHERE l.id = $1 AND l.estado IS NOT NULL`, [id]);
  return rows[0] ?? null;
}

/** Orden bloqueada (dentro de una transacción), o null si no existe o aún no es orden. */
export async function bloquearOrden(db, id) {
  const { rows } = await db.query(
    `SELECT l.id, l.posicion, l.identificador, l.estado, l.precio_banda + l.mano_obra AS valor,
            r.numero, r.cliente_id
       FROM reencauche_llanta l JOIN reencauche r ON r.id = l.reencauche_id
      WHERE l.id = $1 AND l.estado IS NOT NULL
        FOR UPDATE OF l`,
    [id],
  );
  return rows[0] ?? null;
}

/** Actualiza las columnas de una orden: pares [['columna', valor], …]. */
export function actualizarOrden(db, id, pares) {
  return actualizarCampos(db, 'reencauche_llanta', id, pares);
}

/** La llanta sale hoy hacia la reencauchadora indicada. */
export async function registrarEnvio(db, id, terceroId) {
  await db.query(
    `UPDATE reencauche_llanta SET estado = 'En planta', tercero_id = $2, enviada_en = CURRENT_DATE WHERE id = $1`,
    [id, terceroId],
  );
}

/**
 * La llanta se entrega hoy al cliente y se cobra con el medio indicado (con
 * su comprobante, si se pagó por transferencia).
 */
export async function registrarEntrega(db, id, { medio, comprobante, usuarioId }) {
  await db.query(
    `UPDATE reencauche_llanta
        SET estado = 'Entregada', pago_medio = $2, pago_fecha = CURRENT_DATE, cobrada_por = $3, pago_comprobante = $4
      WHERE id = $1`,
    [id, medio, usuarioId, comprobante ?? null],
  );
}
