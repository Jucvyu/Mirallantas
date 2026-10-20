import { actualizarCampos, consultarListado, consultarPorNumero, POOL } from './listado.model.js';

/**
 * Modelo de compras al proveedor (tablas `compra` y `compra_detalle`).
 */

const COMPRA = {
  select: `
    c.id, c.numero, c.fecha, c.total, c.estado, c.estado_entrega AS "estadoEntrega",
    c.proveedor_id AS "proveedorId", pr.nombre_razon_social AS proveedor,
    co.numero AS cotizacion`,
  desde: `
    FROM compra c
    JOIN proveedor pr ON pr.id = c.proveedor_id
    LEFT JOIN cotizacion co ON co.id = c.cotizacion_id`,
  columnaCliente: null,
  columnaNumero: 'c.numero',
};

/** Listado → { filas, total } */
export function listar(parametros) {
  return consultarListado(
    {
      ...COMPRA,
      buscarEn: ['c.numero', 'pr.nombre_razon_social', 'co.numero'],
      filtros: { estado: 'c.estado', estadoEntrega: 'c.estado_entrega', proveedorId: 'c.proveedor_id' },
      orden: 'c.fecha DESC, c.id DESC',
    },
    parametros,
  );
}

/** Una compra por número (ver consultarPorNumero para las opciones). */
export function buscarPorNumero(numero, opciones = {}, db = POOL) {
  return consultarPorNumero(COMPRA, numero, { ...opciones, que: 'La compra' }, db);
}

/**
 * Líneas de la compra con los datos del producto y, si la llanta viene de
 * la cotización de origen, el costo que se confirmó con el proveedor (null
 * = precio sin confirmar).
 */
export async function lineas(compraId, db = POOL) {
  const { rows } = await db.query(
    `SELECT d.id, d.producto_id AS "productoId", p.codigo AS "codigoProducto", p.nombre AS producto,
            p.medidas AS medida, d.cantidad, d.precio_unitario AS "precioUnitario", d.subtotal, d.origen,
            conf.costo_proveedor AS "costoConfirmado", conf.costo_confirmado_en AS "costoConfirmadoEn",
            conf.proveedor AS "proveedorConfirmado"
       FROM compra_detalle d
       JOIN compra c ON c.id = d.compra_id
       JOIN producto p ON p.id = d.producto_id
       LEFT JOIN LATERAL (
         SELECT cd.costo_proveedor, cd.costo_confirmado_en, pr.nombre_razon_social AS proveedor
           FROM cotizacion_detalle cd LEFT JOIN proveedor pr ON pr.id = cd.proveedor_id
          WHERE cd.cotizacion_id = c.cotizacion_id AND cd.producto_id = d.producto_id
            AND cd.costo_confirmado_en IS NOT NULL
          ORDER BY cd.id LIMIT 1
       ) conf ON TRUE
      WHERE d.compra_id = $1 ORDER BY d.id`,
    [compraId],
  );
  return rows;
}

/** ¿El proveedor existe y está activo? */
export async function proveedorActivo(db, proveedorId) {
  const { rows } = await db.query('SELECT activo FROM proveedor WHERE id = $1', [proveedorId]);
  return Boolean(rows[0]?.activo);
}

/**
 * Cotización de origen por número, bloqueada hasta terminar la
 * transacción (por si cambia de estado mientras se registra la compra).
 */
export async function cotizacionBloqueada(db, numero) {
  const { rows } = await db.query('SELECT id, estado FROM cotizacion WHERE numero = $1 FOR UPDATE', [numero]);
  return rows[0] ?? null;
}

/** Crea la cabecera con su número consecutivo (COM-AAAA-NNN) → { id, numero }. */
export async function crear(db, { proveedorId, cotizacionId, total }) {
  const { rows } = await db.query(
    `INSERT INTO compra (numero, proveedor_id, cotizacion_id, total)
     VALUES (siguiente_numero('COM'), $1, $2, $3)
     RETURNING id, numero`,
    [proveedorId, cotizacionId, total],
  );
  return rows[0];
}

/** Agrega una línea con su precio acordado (queda fijo para esta compra). */
export async function crearLinea(db, compraId, l) {
  await db.query(
    `INSERT INTO compra_detalle (compra_id, producto_id, cantidad, precio_unitario, subtotal, origen)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [compraId, l.productoId, l.cantidad, l.precioUnitario, l.cantidad * l.precioUnitario, l.origen],
  );
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'compra', id, pares);
}
