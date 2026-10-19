import { query } from '../db.js';

/**
 * Modelo del tablero: consultas que resumen la operación con los datos
 * reales de la base. No hay cifras escritas a mano.
 */

/** Ventas del mes actual y del anterior (sin contar las anuladas). */
export async function ventasDelMes() {
  const { rows } = await query(`
    SELECT
      COALESCE(SUM(total) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)), 0) AS total_mes,
      COUNT(*) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE))::int AS transacciones,
      COALESCE(SUM(total) FILTER (
        WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      ), 0) AS total_anterior
    FROM venta WHERE estado <> 'Anulada'`);
  return rows[0];
}

/** Pedidos-cotización activos y creados este mes / el anterior. */
export async function pedidos() {
  const { rows } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE estado IN ('Pendiente', 'Aprobada', 'En proceso'))::int AS activos,
      COUNT(*) FILTER (WHERE estado = 'En proceso')::int AS en_proceso,
      COUNT(*) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE))::int AS nuevos_mes,
      COUNT(*) FILTER (
        WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      )::int AS nuevos_anterior
    FROM cotizacion`);
  return rows[0];
}

/**
 * Llantas reencauchadas en los últimos 7 meses. generate_series crea los 7
 * meses aunque alguno no tenga solicitudes.
 */
export async function reencauchesPorMes() {
  const { rows } = await query(`
    SELECT to_char(m.mes, 'YYYY-MM') AS mes, COALESCE(SUM(s.cantidad), 0)::int AS reencauches
      FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '6 months',
                           date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(mes)
      LEFT JOIN solicitud_servicio s
             ON date_trunc('month', s.fecha) = m.mes AND s.estado <> 'Cancelado'
     GROUP BY m.mes
     ORDER BY m.mes`);
  return rows;
}

/** Lo vendido por marca en los últimos 12 meses. */
export async function ventasPorMarca() {
  const { rows } = await query(`
    SELECT m.nombre AS marca, SUM(d.subtotal) AS vendido
      FROM venta_detalle d
      JOIN venta v ON v.id = d.venta_id AND v.estado <> 'Anulada'
      JOIN producto p ON p.id = d.producto_id
      JOIN marca m ON m.id = p.marca_id
     WHERE v.fecha >= CURRENT_DATE - INTERVAL '12 months'
     GROUP BY m.nombre
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
