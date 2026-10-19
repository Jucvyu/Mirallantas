import { actualizarCampos, consultarListado, consultarPorNumero, POOL, SELECT_LINEA } from './listado.model.js';

/**
 * Modelo de ventas (tablas `venta` y `venta_detalle`).
 */

const VENTA = {
  select: `
    v.id, v.numero, v.fecha, v.metodo_pago AS "metodoPago", v.interes, v.total,
    v.cuota_inicial AS "cuotaInicial", v.estado, v.estado_entrega AS "estadoEntrega",
    v.comprobante_url AS "comprobanteUrl",
    v.cliente_id AS "clienteId", cl.nombre_completo AS cliente,
    cl.tipo_documento AS "clienteTipoDocumento", cl.numero_documento AS "clienteDocumento",
    co.numero AS cotizacion,
    v.proveedor_id AS "proveedorId", pr.nombre_razon_social AS proveedor,
    v.tercero_id AS "terceroId", te.nombre_razon_social AS tercero`,
  desde: `
    FROM venta v
    JOIN cliente cl ON cl.id = v.cliente_id
    LEFT JOIN cotizacion co ON co.id = v.cotizacion_id
    LEFT JOIN proveedor pr ON pr.id = v.proveedor_id
    LEFT JOIN tercero te ON te.id = v.tercero_id`,
  columnaCliente: 'v.cliente_id',
  columnaNumero: 'v.numero',
};

/** Nombres de la API → columnas que se pueden cambiar en una venta. */
export const COLUMNAS = {
  estado: 'estado',
  estadoEntrega: 'estado_entrega',
  proveedorId: 'proveedor_id',
  terceroId: 'tercero_id',
  comprobante: 'comprobante_url',
};

/** Listado → { filas, total }. `clienteId` limita a las de un cliente. */
export function listar(parametros) {
  return consultarListado(
    {
      ...VENTA,
      buscarEn: ['v.numero', 'cl.nombre_completo', 'co.numero'],
      filtros: { estado: 'v.estado', estadoEntrega: 'v.estado_entrega', metodoPago: 'v.metodo_pago', clienteId: 'v.cliente_id' },
      orden: 'v.fecha DESC, v.id DESC',
    },
    parametros,
  );
}

/** Una venta por número (ver consultarPorNumero para las opciones). */
export function buscarPorNumero(numero, opciones = {}, db = POOL) {
  return consultarPorNumero(VENTA, numero, { ...opciones, que: 'La venta' }, db);
}

/** Líneas de detalle de una venta. */
export async function lineas(ventaId, db = POOL) {
  const { rows } = await db.query(
    `SELECT ${SELECT_LINEA}
       FROM venta_detalle d
       LEFT JOIN producto p ON p.id = d.producto_id
      WHERE d.venta_id = $1 ORDER BY d.id`,
    [ventaId],
  );
  return rows;
}

/** Venta directa (sin cotización ni líneas). Devuelve su número. */
export async function crearDirecta(v, db = POOL) {
  const { rows } = await db.query(
    `INSERT INTO venta (numero, cliente_id, proveedor_id, tercero_id, fecha, metodo_pago,
                        interes, total, cuota_inicial, comprobante_url)
     VALUES (siguiente_numero('VEN'), $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING numero`,
    [v.clienteId, v.proveedorId ?? null, v.terceroId ?? null, v.fecha, v.metodoPago, v.interes, v.total, v.cuotaInicial, v.comprobante ?? null],
  );
  return rows[0].numero;
}

/**
 * Venta de una cotización completada (`c` es la fila de la cotización):
 * copia sus valores y todas sus líneas.
 */
export async function crearDesdeCotizacion(db, c) {
  const { rows } = await db.query(
    `INSERT INTO venta (numero, cliente_id, cotizacion_id, proveedor_id, fecha, metodo_pago,
                        interes, total, cuota_inicial, estado, estado_entrega)
     VALUES (siguiente_numero('VEN'), $1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, 'Completada', $8)
     RETURNING id`,
    [c.cliente_id, c.id, c.proveedor_id, c.metodo_pago, c.interes, c.total, c.cuota_inicial, c.estado_entrega],
  );
  await db.query(
    `INSERT INTO venta_detalle (venta_id, tipo, producto_id, servicio_id, descripcion, medida,
                                cantidad, precio_unitario, subtotal)
     SELECT $1, tipo, producto_id, servicio_id, descripcion, medida, cantidad, precio_unitario, subtotal
       FROM cotizacion_detalle WHERE cotizacion_id = $2`,
    [rows[0].id, c.id],
  );
  return rows[0].id;
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'venta', id, pares);
}
