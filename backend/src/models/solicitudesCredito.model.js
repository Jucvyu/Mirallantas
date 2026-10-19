import { query } from '../db.js';
import { consultarListado } from './listado.model.js';

/**
 * Modelo de solicitudes de crédito (tabla `solicitud_credito`).
 *
 * Casi siempre nacen de una cotización-pedido a crédito (`cotizacion_id`):
 * el monto es lo que se financia (total − cuota inicial).
 */

const SOLICITUD = `
  s.id, s.numero, s.monto, s.plazo_dias AS "plazoDias", s.fecha, s.estado, s.motivo,
  s.cliente_id AS "clienteId", cl.nombre_completo AS cliente,
  co.numero AS cotizacion, co.total AS "totalCotizacion", co.cuota_inicial AS "cuotaInicial"`;

const DESDE = `FROM solicitud_credito s
  JOIN cliente cl ON cl.id = s.cliente_id
  LEFT JOIN cotizacion co ON co.id = s.cotizacion_id`;

/** Listado → { filas, total }. `clienteId` limita a las de un cliente. */
export function listar(parametros) {
  return consultarListado(
    {
      select: SOLICITUD,
      desde: DESDE,
      buscarEn: ['s.numero', 'cl.nombre_completo', 'co.numero'],
      filtros: { estado: 's.estado' },
      columnaCliente: 's.cliente_id',
      orden: 's.fecha DESC, s.id DESC',
    },
    parametros,
  );
}

/** Una solicitud por número, o null. Con `clienteId`, solo si es de ese cliente. */
export async function buscarPorNumero(numero, clienteId = null) {
  const { rows } = await query(
    `SELECT ${SOLICITUD}, co.cuota_inicial_medio AS "cuotaInicialMedio",
            co.cuota_inicial_comprobante AS "comprobante"
       ${DESDE} WHERE s.numero = $1 ${clienteId ? 'AND s.cliente_id = $2' : ''}`,
    clienteId ? [numero, clienteId] : [numero],
  );
  return rows[0] ?? null;
}

/** Solicitud ligada a una cotización ({ id, numero, estado }), o null. */
export async function deCotizacion(db, cotizacionId) {
  const { rows } = await db.query('SELECT id, numero, estado FROM solicitud_credito WHERE cotizacion_id = $1', [
    cotizacionId,
  ]);
  return rows[0] ?? null;
}

/** Número de la solicitud pendiente del cliente, o null. */
export async function pendienteDeCliente(db, clienteId) {
  const { rows } = await db.query(
    "SELECT numero FROM solicitud_credito WHERE cliente_id = $1 AND estado = 'Pendiente' LIMIT 1",
    [clienteId],
  );
  return rows[0]?.numero ?? null;
}

/** Solicitud pendiente que nace con una cotización a crédito. */
export async function crearParaCotizacion(db, { clienteId, cotizacionId, monto, plazoDias }) {
  const { rows } = await db.query(
    `INSERT INTO solicitud_credito (numero, cliente_id, cotizacion_id, monto, plazo_dias)
     VALUES (siguiente_numero('SLC'), $1, $2, $3, $4) RETURNING numero`,
    [clienteId, cotizacionId, monto, plazoDias],
  );
  return rows[0].numero;
}

/** Fila completa, bloqueada hasta terminar la transacción. */
export async function bloquear(db, numero) {
  const { rows } = await db.query('SELECT * FROM solicitud_credito WHERE numero = $1 FOR UPDATE', [numero]);
  return rows[0] ?? null;
}

/** Registra una solicitud pendiente (SLC-AAAA-NNN) y devuelve su número. */
export async function crear({ clienteId, monto, plazoDias }) {
  const { rows } = await query(
    `INSERT INTO solicitud_credito (numero, cliente_id, monto, plazo_dias)
     VALUES (siguiente_numero('SLC'), $1, $2, $3) RETURNING numero`,
    [clienteId, monto, plazoDias],
  );
  return rows[0].numero;
}

/** Guarda la decisión del asesor. */
export async function resolver(db, id, { estado, motivo }) {
  await db.query('UPDATE solicitud_credito SET estado = $1, motivo = $2 WHERE id = $3', [estado, motivo, id]);
}

/** Elimina una solicitud si sigue pendiente. Devuelve true si la eliminó. */
export async function eliminarPendiente(numero) {
  const { rowCount } = await query("DELETE FROM solicitud_credito WHERE numero = $1 AND estado = 'Pendiente'", [numero]);
  return rowCount > 0;
}
