import { query } from '../db.js';

/**
 * Modelo del tablero: consultas que resumen la operación con los datos
 * reales de la base. No hay cifras escritas a mano.
 */

/**
 * Ventas del mes actual y del anterior (sin contar las anuladas). Una venta a
 * crédito se reconoce abono por abono: cada abono confirmado cuenta en el mes
 * en que se pagó, no en el mes en que nació la venta.
 */
export async function ventasDelMes() {
  const { rows } = await query(`
    WITH cobros AS (
      SELECT v.fecha, v.total AS valor
        FROM venta v
       WHERE v.estado <> 'Anulada'
         AND NOT EXISTS (SELECT 1 FROM credito cr WHERE cr.venta_id = v.id)
      UNION ALL
      SELECT a.fecha, a.monto
        FROM abono a
        JOIN credito cr ON cr.id = a.credito_id
        LEFT JOIN venta v ON v.id = cr.venta_id
       WHERE a.estado = 'Confirmado' AND v.estado IS DISTINCT FROM 'Anulada'
    )
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)), 0) AS total_mes,
      COUNT(*) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE))::int AS transacciones,
      COALESCE(SUM(valor) FILTER (
        WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      ), 0) AS total_anterior
    FROM cobros`);
  return rows[0];
}

/** Pedidos-cotización activos y creados este mes / el anterior. */
export async function pedidos() {
  const { rows } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE estado IN ('Pendiente', 'En proceso'))::int AS activos,
      COUNT(*) FILTER (WHERE estado = 'En proceso')::int AS en_proceso,
      COUNT(*) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE))::int AS nuevos_mes,
      COUNT(*) FILTER (
        WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      )::int AS nuevos_anterior
    FROM cotizacion`);
  return rows[0];
}

/**
 * Llantas reencauchadas en los últimos 7 meses: las que la reencauchadora
 * entregó (por banda) más las solicitudes del flujo anterior. generate_series
 * crea los 7 meses aunque alguno no tenga reencauches.
 */
export async function reencauchesPorMes() {
  const { rows } = await query(`
    WITH llantas AS (
      SELECT date_trunc('month', pago_fecha) AS mes, 1 AS cantidad
        FROM reencauche_llanta WHERE estado = 'Entregada'
      UNION ALL
      SELECT date_trunc('month', fecha), cantidad
        FROM solicitud_servicio WHERE estado <> 'Cancelado'
    )
    SELECT to_char(m.mes, 'YYYY-MM') AS mes, COALESCE(SUM(l.cantidad), 0)::int AS reencauches
      FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '6 months',
                           date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(mes)
      LEFT JOIN llantas l ON l.mes = m.mes
     GROUP BY m.mes
     ORDER BY m.mes`);
  return rows;
}

/**
 * Lo cobrado por marca en los últimos 12 meses, con el mismo criterio de las
 * ventas del mes: de contado, el total de la venta; a crédito, los abonos
 * confirmados en ese periodo. Una factura no dice a qué producto se aplicó
 * cada abono, así que lo cobrado se reparte según el peso de cada línea.
 */
export async function ventasPorMarca() {
  const { rows } = await query(`
    WITH cobrado AS (
      SELECT v.id AS venta_id, v.total AS valor
        FROM venta v
       WHERE v.estado <> 'Anulada'
         AND v.fecha >= CURRENT_DATE - INTERVAL '12 months'
         AND NOT EXISTS (SELECT 1 FROM credito cr WHERE cr.venta_id = v.id)
      UNION ALL
      SELECT v.id, SUM(a.monto)
        FROM venta v
        JOIN credito cr ON cr.venta_id = v.id
        JOIN abono a ON a.credito_id = cr.id AND a.estado = 'Confirmado'
       WHERE v.estado <> 'Anulada'
         AND a.fecha >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY v.id
    ),
    lineas AS (
      SELECT venta_id, SUM(subtotal) AS total FROM venta_detalle GROUP BY venta_id HAVING SUM(subtotal) > 0
    )
    SELECT m.nombre AS marca, ROUND(SUM(d.subtotal * c.valor / l.total)) AS vendido
      FROM cobrado c
      JOIN lineas l ON l.venta_id = c.venta_id
      JOIN venta_detalle d ON d.venta_id = c.venta_id
      JOIN producto p ON p.id = d.producto_id
      JOIN marca m ON m.id = p.marca_id
     GROUP BY m.nombre
    HAVING SUM(d.subtotal * c.valor / l.total) > 0
     ORDER BY vendido DESC`);
  return rows;
}

/** Las 5 cotizaciones más recientes. */
export async function ultimosPedidos() {
  const { rows } = await query(`
    SELECT c.numero, cl.nombre_completo AS cliente, c.total, c.estado, c.fecha
      FROM cotizacion c JOIN cliente cl ON cl.id = c.cliente_id
     ORDER BY c.fecha DESC, c.id DESC
     LIMIT 5`);
  return rows;
}
