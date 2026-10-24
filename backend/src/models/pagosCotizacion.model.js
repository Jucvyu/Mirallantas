import { query } from '../db.js';
import { POOL } from './listado.model.js';

/**
 * Modelo de los pagos de las cotizaciones de contado (tabla
 * `pago_cotizacion`). Cada consignación que sube el cliente es una fila:
 * la más reciente es la que cuenta; las rechazadas quedan como historial.
 */

const SELECT = `id, monto, medio_pago AS "medioPago", comprobante, estado, motivo,
  creado_en AS fecha, revisado_en AS "revisadoEn"`;

/** Registra una consignación "En revisión". */
export async function crear(db, { cotizacionId, monto, medioPago, comprobante }) {
  await db.query(
    'INSERT INTO pago_cotizacion (cotizacion_id, monto, medio_pago, comprobante) VALUES ($1, $2, $3, $4)',
    [cotizacionId, monto, medioPago, comprobante ?? null],
  );
}

/** Historial de una cotización, del más nuevo al más viejo. */
export async function deCotizacion(cotizacionId, db = POOL) {
  const { rows } = await db.query(
    `SELECT ${SELECT} FROM pago_cotizacion WHERE cotizacion_id = $1 ORDER BY creado_en DESC, id DESC`,
    [cotizacionId],
  );
  return rows;
}

/** Historiales de todas las cotizaciones de un cliente (portal). */
export async function deCliente(clienteId) {
  const { rows } = await query(
    `SELECT p.cotizacion_id AS "cotizacionId", p.id, p.monto, p.medio_pago AS "medioPago", p.comprobante,
            p.estado, p.motivo, p.creado_en AS fecha, p.revisado_en AS "revisadoEn"
       FROM pago_cotizacion p JOIN cotizacion c ON c.id = p.cotizacion_id
      WHERE c.cliente_id = $1
      ORDER BY p.creado_en DESC, p.id DESC`,
    [clienteId],
  );
  return rows;
}

/** El pago más reciente, bloqueado hasta terminar la transacción (o null). */
export async function ultimoBloqueado(db, cotizacionId) {
  const { rows } = await db.query(
    `SELECT id, estado, monto, medio_pago AS "medioPago", comprobante FROM pago_cotizacion WHERE cotizacion_id = $1
      ORDER BY creado_en DESC, id DESC LIMIT 1 FOR UPDATE`,
    [cotizacionId],
  );
  return rows[0] ?? null;
}

/** Guarda la decisión del asesor. */
export async function resolver(db, id, { estado, motivo }) {
  await db.query('UPDATE pago_cotizacion SET estado = $2, motivo = $3, revisado_en = now() WHERE id = $1', [
    id,
    estado,
    motivo ?? null,
  ]);
}

/** Subconsulta: estado del pago más reciente de la cotización `c`. */
export const SUBCONSULTA_ESTADO = `(SELECT p.estado FROM pago_cotizacion p WHERE p.cotizacion_id = c.id
  ORDER BY p.creado_en DESC, p.id DESC LIMIT 1)`;

/**
 * Estado de pago de la cotización, en tres valores: Pendiente, Aprobado o
 * Rechazado (null si no lleva ningún pago). Junta todo lo que se paga:
 *   - De contado: la última consignación ("En revisión" = Pendiente).
 *   - A crédito: la solicitud de crédito y, ya aprobada, el pago de la cuota inicial.
 *   - Cada servicio de reencauche (sin precio, por pagar o en revisión = Pendiente).
 * Si algo se rechazó → Rechazado; si todo se aprobó → Aprobado; si no, Pendiente.
 */
export const SUBCONSULTA_ESTADO_PAGO = `(
  SELECT CASE
           WHEN COUNT(*) = 0 THEN NULL
           WHEN bool_or(e = 'Rechazado') THEN 'Rechazado'
           WHEN bool_and(e = 'Aprobado') THEN 'Aprobado'
           ELSE 'Pendiente'
         END
    FROM (
      -- La consignación más reciente; a crédito, sin ella (y sin cuota ya
      -- registrada, como en los créditos anteriores) la cuota sigue Pendiente
      SELECT COALESCE(
               (SELECT p.estado FROM pago_cotizacion p WHERE p.cotizacion_id = c.id
                 ORDER BY p.creado_en DESC, p.id DESC LIMIT 1),
               CASE WHEN c.metodo_pago = 'Crédito' AND c.cuota_inicial_medio IS NULL THEN 'Pendiente' END
             ) AS e
      UNION ALL
      SELECT (SELECT CASE s.estado WHEN 'Aprobada' THEN 'Aprobado' WHEN 'Rechazada' THEN 'Rechazado' END
                FROM solicitud_credito s WHERE s.cotizacion_id = c.id ORDER BY s.id DESC LIMIT 1)
      UNION ALL
      SELECT ss.pago_estado
        FROM cotizacion_detalle d JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
       WHERE d.cotizacion_id = c.id AND ss.estado <> 'Cancelado'
    ) pagos (e)
   WHERE e IS NOT NULL)`;

/**
 * Lo que suman los servicios de reencauche que todavía NO están dentro del
 * total de la cotización (los de cotizaciones anteriores a esta regla, que se
 * pagan aparte). Los que ya tienen su precio en la línea de la cotización
 * están sumados en su total y no se vuelven a contar.
 */
export const SUBCONSULTA_TOTAL_SERVICIOS = `(
  SELECT COALESCE(SUM(ss.precio), 0)::bigint
    FROM cotizacion_detalle d JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
   WHERE d.cotizacion_id = c.id AND ss.estado <> 'Cancelado' AND COALESCE(d.subtotal, 0) = 0)`;
