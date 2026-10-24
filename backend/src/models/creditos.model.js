import { query } from '../db.js';
import { consultarListado, consultarPorNumero, POOL } from './listado.model.js';

/**
 * Modelo de créditos (tabla `credito`).
 *
 * La base de datos garantiza la regla central de la cartera: un cliente
 * solo puede tener un crédito con saldo pendiente (índice único parcial).
 */

const CREDITO = {
  select: `
    cr.id, cr.numero, cr.monto_total AS "montoTotal", cr.saldo_pendiente AS "saldoPendiente",
    cr.plazo_dias AS "plazoDias", cr.fecha_apertura AS "fechaApertura", cr.fecha_limite AS "fechaLimite",
    cr.activo, cr.iniciado, cr.cliente_id AS "clienteId", cl.nombre_completo AS cliente,
    v.numero AS venta, co.numero AS cotizacion`,
  desde: `
    FROM credito cr
    JOIN cliente cl ON cl.id = cr.cliente_id
    LEFT JOIN venta v ON v.id = cr.venta_id
    LEFT JOIN cotizacion co ON co.id = cr.cotizacion_id`,
  columnaCliente: 'cr.cliente_id',
  columnaNumero: 'cr.numero',
};

/** Listado → { filas, total }. `clienteId` limita a los de un cliente. */
export function listar(parametros) {
  return consultarListado(
    {
      ...CREDITO,
      buscarEn: ['cr.numero', 'cl.nombre_completo'],
      filtros: { clienteId: 'cr.cliente_id' },
      orden: 'cr.fecha_apertura DESC, cr.id DESC',
    },
    parametros,
  );
}

/** Un crédito por número (ver consultarPorNumero para las opciones). */
export function buscarPorNumero(numero, opciones = {}, db = POOL) {
  return consultarPorNumero(CREDITO, numero, { ...opciones, que: 'El crédito' }, db);
}

/**
 * Cotización que se quiere financiar, bloqueada, con su venta (si la
 * tiene). Devuelve null si no existe.
 */
export async function cotizacionParaFinanciar(db, numero) {
  const { rows } = await db.query(
    `SELECT c.id, c.cliente_id, c.estado, (SELECT v.id FROM venta v WHERE v.cotizacion_id = c.id) AS venta_id
       FROM cotizacion c WHERE c.numero = $1 FOR UPDATE`,
    [numero],
  );
  return rows[0] ?? null;
}

/** Número del crédito que ya financia esa cotización, o null. */
export async function creditoDeCotizacion(db, cotizacionId) {
  const { rows } = await db.query('SELECT numero FROM credito WHERE cotizacion_id = $1', [cotizacionId]);
  return rows[0]?.numero ?? null;
}

/**
 * Abre un crédito por todo su valor, con su número consecutivo
 * (CRE-AAAA-NNN). La fecha límite es hoy + el plazo. Devuelve el número.
 *
 * `iniciado: false` lo deja esperando la cuota inicial: no recibe abonos y
 * su plazo empieza a correr cuando se paga (ver iniciar).
 */
export async function crear(db, { clienteId, ventaId, cotizacionId, montoTotal, plazoDias, iniciado = true }) {
  const { rows } = await db.query(
    `INSERT INTO credito (numero, cliente_id, venta_id, cotizacion_id, monto_total, saldo_pendiente,
                          plazo_dias, fecha_limite, iniciado)
     VALUES (siguiente_numero('CRE'), $1, $2, $3, $4, $4, $5, CURRENT_DATE + $5::int, $6)
     RETURNING numero`,
    [clienteId, ventaId ?? null, cotizacionId ?? null, montoTotal, plazoDias, iniciado],
  );
  return rows[0].numero;
}

/** Pagada la cuota inicial, el crédito empieza: el plazo corre desde hoy. */
export async function iniciar(db, creditoId) {
  await db.query(
    `UPDATE credito SET iniciado = TRUE, fecha_apertura = CURRENT_DATE, fecha_limite = CURRENT_DATE + plazo_dias
      WHERE id = $1 AND NOT iniciado`,
    [creditoId],
  );
}

/** La cotización se rechazó antes de pagar la cuota inicial: su crédito no llegó a empezar y se elimina. */
export async function eliminarSinIniciar(db, cotizacionId) {
  await db.query(
    `DELETE FROM credito cr WHERE cr.cotizacion_id = $1 AND NOT cr.iniciado
        AND NOT EXISTS (SELECT 1 FROM abono a WHERE a.credito_id = cr.id)`,
    [cotizacionId],
  );
}

/** Activa o desactiva. Devuelve true si el crédito existía. */
export async function cambiarActivo(numero, activo) {
  const { rowCount } = await query('UPDATE credito SET activo = $1 WHERE numero = $2', [activo, numero]);
  return rowCount > 0;
}

/** Descuenta un abono confirmado del saldo del crédito. */
export async function descontarSaldo(db, creditoId, monto) {
  await db.query('UPDATE credito SET saldo_pendiente = saldo_pendiente - $1 WHERE id = $2', [monto, creditoId]);
}

/** Liga el crédito de una cotización a la venta que se generó de ella. */
export async function ligarVenta(db, cotizacionId, ventaId) {
  await db.query('UPDATE credito SET venta_id = $1 WHERE cotizacion_id = $2 AND venta_id IS NULL', [ventaId, cotizacionId]);
}
