import { query } from '../db.js';
import { actualizarCampos, consultarListado } from './listado.model.js';

/**
 * Modelo de abonos (tabla `abono`). El abono que sube un cliente nace
 * "Pendiente" (el saldo baja cuando un asesor lo confirma); el que registra
 * el asesor sobre una factura nace "Confirmado" y baja el saldo en el acto.
 *
 * La "factura" de un abono es la venta a crédito: su crédito guarda el
 * saldo pendiente (credito.venta_id).
 */

const SELECT_ABONO = `
  a.id, a.numero, a.fecha, a.monto, a.medio_pago AS "medioPago",
  a.comprobante_url AS "comprobanteUrl", a.estado, a.motivo_rechazo AS "motivoRechazo",
  cr.numero AS credito, v.numero AS factura, cl.nombre_completo AS cliente,
  cl.tipo_documento AS "tipoDocumento", cl.numero_documento AS "numeroDocumento",
  cr.saldo_pendiente AS "saldoCredito"`;

const DESDE = `
  FROM abono a
  JOIN credito cr ON cr.id = a.credito_id
  JOIN cliente cl ON cl.id = cr.cliente_id
  LEFT JOIN venta v ON v.id = cr.venta_id`;

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

// ---- Facturas (ventas a crédito) ---------------------------------------------------

/**
 * Facturas que admiten abonos: ventas a crédito no anuladas cuyo crédito
 * está activo y con saldo. `clienteId` limita a las de un cliente.
 */
export async function facturasConSaldo({ clienteId } = {}) {
  const { rows } = await query(
    `SELECT v.numero, v.fecha, v.total, cl.id AS "clienteId", cl.nombre_completo AS cliente,
            cl.tipo_documento AS "tipoDocumento", cl.numero_documento AS "numeroDocumento",
            cr.numero AS credito, cr.saldo_pendiente AS "saldoPendiente"
       FROM venta v
       JOIN credito cr ON cr.venta_id = v.id
       JOIN cliente cl ON cl.id = v.cliente_id
      WHERE v.estado <> 'Anulada' AND cr.activo AND cr.saldo_pendiente > 0
        AND ($1::int IS NULL OR v.cliente_id = $1)
      ORDER BY v.fecha DESC, v.id DESC`,
    [clienteId ?? null],
  );
  return rows;
}

/**
 * Factura con su crédito, ambos bloqueados hasta el fin de la transacción:
 * dos abonos a la vez sobre la misma factura esperan su turno y ninguno
 * puede dejar el saldo en negativo.
 */
export async function facturaBloqueada(db, numeroVenta) {
  const { rows } = await db.query(
    `SELECT v.id AS venta_id, v.numero, v.estado, cr.id AS credito_id, cr.numero AS credito,
            cr.activo, cr.iniciado, cr.saldo_pendiente, cr.cliente_id
       FROM venta v
       JOIN credito cr ON cr.venta_id = v.id
      WHERE v.numero = $1
      FOR UPDATE OF v, cr`,
    [numeroVenta],
  );
  return rows[0] ?? null;
}
