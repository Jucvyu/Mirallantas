import { query } from '../db.js';
import { actualizarCampos, consultarListado } from './listado.model.js';

/**
 * Modelo de abonos (tabla `abono`). Un abono nace "Pendiente"; el saldo
 * del crédito baja solo cuando un asesor lo confirma.
 */

const SELECT_ABONO = `
  a.id, a.numero, a.fecha, a.monto, a.medio_pago AS "medioPago",
  a.comprobante_url AS "comprobanteUrl", a.estado, a.motivo_rechazo AS "motivoRechazo",
  cr.numero AS credito, cl.nombre_completo AS cliente`;

const DESDE = `
  FROM abono a
  JOIN credito cr ON cr.id = a.credito_id
  JOIN cliente cl ON cl.id = cr.cliente_id`;

/** Listado → { filas, total } */
export function listar(parametros) {
  return consultarListado(
    {
      select: SELECT_ABONO,
      desde: DESDE,
      buscarEn: ['a.numero', 'cr.numero', 'cl.nombre_completo'],
      filtros: { estado: 'a.estado', medioPago: 'a.medio_pago', credito: 'cr.numero' },
      columnaCliente: 'cr.cliente_id',
      orden: 'a.fecha DESC, a.id DESC',
    },
    parametros,
  );
}

/** Abonos de un crédito, del más reciente al más antiguo. */
export async function deCredito(creditoId) {
  const { rows } = await query(`SELECT ${SELECT_ABONO} ${DESDE} WHERE a.credito_id = $1 ORDER BY a.fecha DESC, a.id DESC`, [
    creditoId,
  ]);
  return rows;
}

/** Un abono por número, o null. */
export async function buscarPorNumero(numero) {
  const { rows } = await query(`SELECT ${SELECT_ABONO} ${DESDE} WHERE a.numero = $1`, [numero]);
  return rows[0] ?? null;
}

/**
 * Abono junto con el saldo de su crédito, bloqueando ambas filas: así dos
 * confirmaciones al mismo tiempo no pueden dejar el saldo mal.
 */
export async function bloquearConCredito(db, numero) {
  const { rows } = await db.query(
    `SELECT a.id, a.numero, a.estado, a.monto, a.credito_id, cr.saldo_pendiente, cr.cliente_id
       FROM abono a JOIN credito cr ON cr.id = a.credito_id
      WHERE a.numero = $1
      FOR UPDATE OF a, cr`,
    [numero],
  );
  return rows[0] ?? null;
}

/** Registra un abono pendiente con su número (ABO-AAAA-NNN) y lo devuelve. */
export async function crear(db, { creditoId, monto, medioPago, comprobante, claveIdempotencia, estado = 'Pendiente' }) {
  const { rows } = await db.query(
    `INSERT INTO abono (numero, credito_id, monto, medio_pago, comprobante_url, clave_idempotencia, estado)
     VALUES (siguiente_numero('ABO'), $1, $2, $3, $4, $5, $6)
     RETURNING numero`,
    [creditoId, monto, medioPago, comprobante ?? null, claveIdempotencia ?? null, estado],
  );
  return rows[0].numero;
}

/** Abono ya registrado con esa clave de idempotencia en ese crédito, o null. */
export async function numeroPorClave(db, creditoId, clave) {
  const { rows } = await db.query('SELECT numero FROM abono WHERE credito_id = $1 AND clave_idempotencia = $2', [
    creditoId,
    clave,
  ]);
  return rows[0]?.numero ?? null;
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'abono', id, pares);
}
