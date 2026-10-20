import { query } from '../db.js';
import { CAMPOS_ETAPA } from './cotizaciones.model.js';
import { SUBCONSULTA_ESTADO, SUBCONSULTA_ESTADO_PAGO, SUBCONSULTA_TOTAL_SERVICIOS } from './pagosCotizacion.model.js';

/**
 * Modelo del portal del cliente: todo lo que el cliente en sesión ve en su
 * portal, siempre filtrado por su `clienteId`.
 */

/** Cotizaciones del cliente (sin líneas), de la más reciente a la más antigua. */
export async function cotizaciones(clienteId) {
  const { rows } = await query(
    `SELECT c.id, c.numero, c.fecha, c.metodo_pago AS "metodoPago", c.plazo_dias AS "plazoDias",
            c.subtotal, c.interes, c.total, c.cuota_inicial AS "cuotaInicial", c.confirmado,
            c.estado, c.estado_entrega AS "estadoEntrega", c.direccion_entrega AS "direccionEntrega",
            c.motivo_cancelacion AS "motivoCancelacion", ${CAMPOS_ETAPA},
            (SELECT v.numero FROM venta v WHERE v.cotizacion_id = c.id) AS venta,
            ${SUBCONSULTA_ESTADO} AS "pagoEstado",
            ${SUBCONSULTA_ESTADO_PAGO} AS "estadoPago",
            ${SUBCONSULTA_TOTAL_SERVICIOS} AS "totalServicios"
       FROM cotizacion c
      WHERE c.cliente_id = $1
      ORDER BY c.fecha DESC, c.id DESC`,
    [clienteId],
  );
  return rows;
}

/** Todas las líneas de las cotizaciones del cliente, con el estado de cada reencauche. */
export async function lineasDeCotizaciones(clienteId) {
  const { rows } = await query(
    `SELECT d.cotizacion_id AS "cotizacionId", d.id, d.tipo, d.producto_id AS "productoId",
            p.codigo AS "codigoProducto", d.descripcion, d.medida, d.cantidad,
            d.precio_unitario AS "precioUnitario", d.subtotal,
            ss.numero AS "solicitudServicio", ss.estado AS "estadoServicio",
            ss.estado_evidencia AS "estadoEvidencia", ss.descripcion AS "descripcionCarcasa",
            ss.tiempo_estimado AS "tiempoEstimado", ss.garantia, ss.fecha AS "fechaServicio",
            ss.medidas AS "medidasServicio", ss.cantidad AS "cantidadServicio",
            sv.nombre AS servicio, te.nombre_razon_social AS tercero,
            ss.precio AS "precioServicio", ss.pago_estado AS "pagoEstado", ss.pago_medio AS "pagoMedio",
            ss.pago_comprobante AS "pagoComprobante", ss.pago_fecha AS "pagoFecha", ss.pago_motivo AS "pagoMotivo"
       FROM cotizacion_detalle d
       JOIN cotizacion c ON c.id = d.cotizacion_id
       LEFT JOIN producto p ON p.id = d.producto_id
       LEFT JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
       LEFT JOIN servicio sv ON sv.id = ss.servicio_id
       LEFT JOIN tercero te ON te.id = ss.tercero_id
      WHERE c.cliente_id = $1
      ORDER BY d.id`,
    [clienteId],
  );
  return rows;
}

/** Créditos del cliente. */
export async function creditos(clienteId) {
  const { rows } = await query(
    `SELECT cr.id, cr.numero, cr.monto_total AS "montoTotal", cr.saldo_pendiente AS "saldoPendiente",
            cr.plazo_dias AS "plazoDias", cr.fecha_apertura AS "fechaApertura", cr.fecha_limite AS "fechaLimite",
            cr.activo, v.numero AS venta, co.numero AS cotizacion
       FROM credito cr
       LEFT JOIN venta v ON v.id = cr.venta_id
       LEFT JOIN cotizacion co ON co.id = cr.cotizacion_id
      WHERE cr.cliente_id = $1
      ORDER BY cr.fecha_apertura DESC, cr.id DESC`,
    [clienteId],
  );
  return rows;
}

/** Abonos de todos los créditos del cliente. */
export async function abonos(clienteId) {
  const { rows } = await query(
    `SELECT a.id, a.numero, a.fecha, a.monto, a.medio_pago AS "medioPago",
            a.comprobante_url AS "comprobanteUrl", a.estado, a.motivo_rechazo AS "motivoRechazo",
            cr.numero AS credito
       FROM abono a JOIN credito cr ON cr.id = a.credito_id
      WHERE cr.cliente_id = $1
      ORDER BY a.fecha DESC, a.id DESC`,
    [clienteId],
  );
  return rows;
}

/** Solicitudes de crédito del cliente. */
export async function solicitudesCredito(clienteId) {
  const { rows } = await query(
    `SELECT s.id, s.numero, s.monto, s.plazo_dias AS "plazoDias", s.fecha, s.estado, s.motivo,
            co.numero AS cotizacion
       FROM solicitud_credito s
       LEFT JOIN cotizacion co ON co.id = s.cotizacion_id
      WHERE s.cliente_id = $1
      ORDER BY s.fecha DESC, s.id DESC`,
    [clienteId],
  );
  return rows;
}
