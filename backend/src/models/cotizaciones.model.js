import { actualizarCampos, consultarListado, consultarPorNumero, POOL, SELECT_LINEA } from './listado.model.js';
import { SUBCONSULTA_ESTADO, SUBCONSULTA_ESTADO_PAGO, SUBCONSULTA_TOTAL_SERVICIOS } from './pagosCotizacion.model.js';

/**
 * Modelo de cotizaciones-pedido (tablas `cotizacion` y `cotizacion_detalle`).
 * Solo SQL: las reglas (precios, crédito, estados) están en el controlador.
 */

const COTIZACION = {
  select: `
    c.id, c.numero, c.fecha, c.metodo_pago AS "metodoPago", c.plazo_dias AS "plazoDias",
    c.subtotal, c.interes, c.total, c.cuota_inicial AS "cuotaInicial",
    c.cuota_inicial_medio AS "cuotaInicialMedio", c.confirmado,
    c.estado, c.estado_entrega AS "estadoEntrega", c.direccion_entrega AS "direccionEntrega",
    c.motivo_cancelacion AS "motivoCancelacion",
    c.cliente_id AS "clienteId", cl.nombre_completo AS cliente,
    c.proveedor_id AS "proveedorId", pr.nombre_razon_social AS proveedor,
    (SELECT v.numero FROM venta v WHERE v.cotizacion_id = c.id) AS venta,
    -- Pago de contado: estado de la consignación más reciente (null = no tiene)
    ${SUBCONSULTA_ESTADO} AS "pagoEstado",
    ${SUBCONSULTA_ESTADO_PAGO} AS "estadoPago",
    ${SUBCONSULTA_TOTAL_SERVICIOS} AS "totalServicios"`,
  desde: `
    FROM cotizacion c
    JOIN cliente cl ON cl.id = c.cliente_id
    LEFT JOIN proveedor pr ON pr.id = c.proveedor_id`,
  columnaCliente: 'c.cliente_id',
  columnaNumero: 'c.numero',
};

/** Nombres de la API → columnas que el asesor puede cambiar. */
export const COLUMNAS = {
  estado: 'estado',
  estadoEntrega: 'estado_entrega',
  motivoCancelacion: 'motivo_cancelacion',
  proveedorId: 'proveedor_id',
  direccionEntrega: 'direccion_entrega',
};

/** Listado → { filas, total }. `clienteId` limita a las de un cliente. */
export function listar(parametros) {
  return consultarListado(
    {
      ...COTIZACION,
      buscarEn: ['c.numero', 'cl.nombre_completo'],
      filtros: { estado: 'c.estado', estadoEntrega: 'c.estado_entrega', metodoPago: 'c.metodo_pago', clienteId: 'c.cliente_id' },
      orden: 'c.fecha DESC, c.id DESC',
    },
    parametros,
  );
}

/** Una cotización por número (ver consultarPorNumero para las opciones). */
export function buscarPorNumero(numero, opciones = {}, db = POOL) {
  return consultarPorNumero(COTIZACION, numero, { ...opciones, que: 'La cotización' }, db);
}

/** Líneas de la cotización, con el estado de la solicitud de reencauche de cada servicio. */
export async function lineas(cotizacionId, db = POOL) {
  const { rows } = await db.query(
    `SELECT ${SELECT_LINEA},
            ss.numero AS "solicitudServicio", ss.estado AS "estadoServicio",
            ss.estado_evidencia AS "estadoEvidencia", ss.foto_url AS foto,
            ss.descripcion AS "descripcionCarcasa", ss.tiempo_estimado AS "tiempoEstimado",
            ss.garantia, ss.fecha AS "fechaServicio", te.nombre_razon_social AS tercero
       FROM cotizacion_detalle d
       LEFT JOIN producto p ON p.id = d.producto_id
       LEFT JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
       LEFT JOIN tercero te ON te.id = ss.tercero_id
      WHERE d.cotizacion_id = $1 ORDER BY d.id`,
    [cotizacionId],
  );
  return rows;
}

/** Fila completa de la tabla (con nombres de columna SQL), para generar la venta. */
export async function fila(db, id) {
  const { rows } = await db.query('SELECT * FROM cotizacion WHERE id = $1', [id]);
  return rows[0];
}

/** Crea la cabecera con su número consecutivo (PED-AAAA-NNN) → { id, numero }. */
export async function crear(db, c) {
  const { rows } = await db.query(
    `INSERT INTO cotizacion (numero, cliente_id, proveedor_id, fecha, metodo_pago, plazo_dias,
                             subtotal, interes, total, cuota_inicial, cuota_inicial_medio,
                             cuota_inicial_comprobante, confirmado, direccion_entrega, clave_idempotencia)
     VALUES (siguiente_numero('PED'), $1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5,
             $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, numero`,
    [
      c.clienteId,
      c.proveedorId ?? null,
      c.fecha ?? null,
      c.metodoPago,
      c.plazoDias,
      c.subtotal,
      c.interes,
      c.total,
      c.cuotaInicial,
      c.cuotaInicialMedio ?? null,
      c.cuotaInicialComprobante ?? null,
      c.confirmado,
      c.direccionEntrega,
      c.claveIdempotencia ?? null,
    ],
  );
  return rows[0];
}

/** Cotización ya registrada con esa clave de idempotencia para ese cliente, o null. */
export async function numeroPorClave(db, clienteId, clave) {
  const { rows } = await db.query('SELECT numero FROM cotizacion WHERE cliente_id = $1 AND clave_idempotencia = $2', [
    clienteId,
    clave,
  ]);
  return rows[0]?.numero ?? null;
}

/** Agrega una línea de detalle (producto o servicio). */
export async function crearLinea(db, cotizacionId, l) {
  await db.query(
    `INSERT INTO cotizacion_detalle (cotizacion_id, tipo, producto_id, servicio_id, solicitud_servicio_id,
                                     descripcion, medida, cantidad, precio_unitario, subtotal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      cotizacionId,
      l.tipo,
      l.productoId ?? null,
      l.servicioId ?? null,
      l.solicitudServicioId ?? null,
      l.descripcion,
      l.medida ?? null,
      l.cantidad,
      l.precioUnitario,
      l.precioUnitario * l.cantidad,
    ],
  );
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
/**
 * Cotización a la que pertenece una solicitud de reencauche, con su estado
 * y su estado de pago (o null si la solicitud no viene de una cotización).
 */
export async function deSolicitudServicio(db, solicitudId) {
  const { rows } = await db.query(
    `SELECT c.id, c.numero, c.estado, ${SUBCONSULTA_ESTADO_PAGO} AS "estadoPago"
       FROM cotizacion c JOIN cotizacion_detalle d ON d.cotizacion_id = c.id
      WHERE d.solicitud_servicio_id = $1
      LIMIT 1`,
    [solicitudId],
  );
  return rows[0] ?? null;
}

export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'cotizacion', id, pares);
}

/** ¿Alguna línea quedó sin precio? (no se puede generar la venta) */
export async function tieneLineasSinPrecio(db, id) {
  const { rows } = await db.query(
    'SELECT 1 FROM cotizacion_detalle WHERE cotizacion_id = $1 AND precio_unitario IS NULL LIMIT 1',
    [id],
  );
  return rows.length > 0;
}

/** Ids de las solicitudes de reencauche que nacieron con la cotización. */
export async function solicitudesDeLineas(db, id) {
  const { rows } = await db.query(
    'SELECT solicitud_servicio_id AS id FROM cotizacion_detalle WHERE cotizacion_id = $1 AND solicitud_servicio_id IS NOT NULL',
    [id],
  );
  return rows.map((r) => r.id);
}

/** Elimina la cotización (sus líneas se borran en cascada). */
export async function eliminar(db, id) {
  await db.query('DELETE FROM cotizacion WHERE id = $1', [id]);
}
