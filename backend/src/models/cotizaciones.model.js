import { actualizarCampos, consultarListado, consultarPorNumero, POOL, SELECT_LINEA } from './listado.model.js';
import { SUBCONSULTA_ESTADO, SUBCONSULTA_ESTADO_PAGO, SUBCONSULTA_TOTAL_SERVICIOS } from './pagosCotizacion.model.js';

/**
 * Modelo de cotizaciones-pedido (tablas `cotizacion` y `cotizacion_detalle`).
 * Solo SQL: las reglas (precios, crédito, estados) están en el controlador.
 */

/**
 * Etapa comercial de la cotización (la calcula la base con la fecha del
 * negocio, nunca la del navegador):
 *   Solicitud  el cliente pidió productos; los precios están por confirmar
 *   Emitida    cotización formal con precios, vigente (hasta vence_en)
 *   Vencida    cotización formal que no se aceptó a tiempo
 *   Aceptada   el cliente eligió contado o crédito; sigue el pedido
 */
export const CAMPOS_ETAPA = `
    c.emitida_en AS "emitidaEn", c.vence_en AS "venceEn",
    CASE
      WHEN NOT c.confirmado THEN 'Solicitud'
      WHEN c.metodo_pago IS NOT NULL THEN 'Aceptada'
      WHEN c.vence_en < CURRENT_DATE THEN 'Vencida'
      ELSE 'Emitida'
    END AS etapa`;

const COTIZACION = {
  select: `
    c.id, c.numero, c.fecha, c.metodo_pago AS "metodoPago", c.plazo_dias AS "plazoDias",
    c.subtotal, c.interes, c.total, c.cuota_inicial AS "cuotaInicial",
    c.cuota_inicial_medio AS "cuotaInicialMedio", c.confirmado,
    c.estado, c.estado_entrega AS "estadoEntrega", c.direccion_entrega AS "direccionEntrega",
    c.motivo_cancelacion AS "motivoCancelacion", ${CAMPOS_ETAPA},
    c.cliente_id AS "clienteId", cl.nombre_completo AS cliente,
    c.proveedor_id AS "proveedorId", pr.nombre_razon_social AS proveedor,
    (SELECT v.numero FROM venta v WHERE v.cotizacion_id = c.id) AS venta,
    -- Pago de contado: estado de la consignación más reciente (null = no tiene)
    ${SUBCONSULTA_ESTADO} AS "pagoEstado",
    ${SUBCONSULTA_ESTADO_PAGO} AS "estadoPago",
    ${SUBCONSULTA_TOTAL_SERVICIOS} AS "totalServicios",
    -- Reencauches sin precio: mientras haya alguno, la cotización no se emite
    (SELECT count(*)::int FROM cotizacion_detalle d JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
      WHERE d.cotizacion_id = c.id AND ss.precio IS NULL) AS "serviciosSinPrecio"`,
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

/**
 * Datos internos de cada línea: proveedor y costo confirmado, el precio de
 * venta sugerido del catálogo y el último costo de compra. La vista de
 * documentos los quita cuando quien pregunta es un cliente del portal.
 */
export const CAMPOS_INTERNOS_LINEA = [
  'proveedorLineaId',
  'proveedorLinea',
  'costoProveedor',
  'costoConfirmadoEn',
  'precioSugerido',
  'ultimoCosto',
];

/** Líneas de la cotización, con el estado de la solicitud de reencauche de cada servicio. */
export async function lineas(cotizacionId, db = POOL) {
  const { rows } = await db.query(
    `SELECT ${SELECT_LINEA},
            ss.numero AS "solicitudServicio", ss.estado AS "estadoServicio",
            ss.estado_evidencia AS "estadoEvidencia", ss.foto_url AS foto, ss.fotos,
            ss.observacion_revision AS "observacionRevision", ss.motivo_cancelacion AS "motivoCancelacionServicio",
            ss.descripcion AS "descripcionCarcasa", ss.tiempo_estimado AS "tiempoEstimado",
            ss.garantia, ss.fecha AS "fechaServicio", te.nombre_razon_social AS tercero,
            ss.precio AS "precioServicio",
            d.proveedor_id AS "proveedorLineaId", pv.nombre_razon_social AS "proveedorLinea",
            d.costo_proveedor AS "costoProveedor", d.costo_confirmado_en AS "costoConfirmadoEn",
            p.precio_venta AS "precioSugerido", p.precio_compra AS "ultimoCosto"
       FROM cotizacion_detalle d
       LEFT JOIN producto p ON p.id = d.producto_id
       LEFT JOIN proveedor pv ON pv.id = d.proveedor_id
       LEFT JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
       LEFT JOIN tercero te ON te.id = ss.tercero_id
      WHERE d.cotizacion_id = $1 ORDER BY d.id`,
    [cotizacionId],
  );
  return rows;
}

/**
 * Guarda en una línea de producto el proveedor con el que se verificó el
 * precio (con fecha y usuario), su precio de compra (lo que cobra el
 * proveedor) y el precio de venta definitivo.
 */
export async function confirmarLinea(db, lineaId, { proveedorId, costoProveedor, precioUnitario, usuarioId }) {
  await db.query(
    `UPDATE cotizacion_detalle
        SET proveedor_id = $2, costo_confirmado_en = now(), costo_confirmado_por = $3,
            precio_unitario = $4::bigint, subtotal = $4::bigint * cantidad, costo_proveedor = $5
      WHERE id = $1`,
    [lineaId, proveedorId, usuarioId, precioUnitario, costoProveedor],
  );
}

/**
 * Emite la cotización formal: guarda los valores y la vigencia. Las fechas
 * salen de la base (zona horaria del negocio): hoy y hoy + `dias`.
 */
export async function emitir(db, id, { subtotal, dias }) {
  await db.query(
    `UPDATE cotizacion
        SET subtotal = $2, interes = 0, total = $2, confirmado = TRUE,
            emitida_en = CURRENT_DATE, vence_en = CURRENT_DATE + $3::int
      WHERE id = $1`,
    [id, subtotal, dias],
  );
}

/** Fila completa de la tabla (con nombres de columna SQL), para generar la venta. */
export async function fila(db, id) {
  const { rows } = await db.query('SELECT * FROM cotizacion WHERE id = $1', [id]);
  return rows[0];
}

/**
 * Crea la cabecera con su número consecutivo (PED-AAAA-NNN) → { id, numero }.
 * La fecha es la de hoy (la pone la base). Los valores quedan en 0 hasta
 * que el asesor emita la cotización formal.
 */
export async function crear(db, c) {
  const { rows } = await db.query(
    `INSERT INTO cotizacion (numero, cliente_id, proveedor_id, metodo_pago, confirmado,
                             direccion_entrega, clave_idempotencia)
     VALUES (siguiente_numero('PED'), $1, $2, $3, $4, $5, $6)
     RETURNING id, numero`,
    [
      c.clienteId,
      c.proveedorId ?? null,
      c.metodoPago ?? null,
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
      // Producto: sin precio hasta la cotización formal (NULL = por confirmar)
      l.precioUnitario ?? null,
      l.precioUnitario == null ? null : l.precioUnitario * l.cantidad,
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
    `SELECT c.id, c.numero, c.estado, c.confirmado, c.metodo_pago AS "metodoPago",
            ${SUBCONSULTA_ESTADO_PAGO} AS "estadoPago"
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

/**
 * Lleva a las líneas de reencauche de la cotización el precio que el asesor
 * asignó en "Solicitudes de servicio" (el valor total del servicio): así se
 * suma al total y se ve en el detalle. Devuelve lo que suman.
 */
export async function preciarServicios(db, cotizacionId) {
  const { rows } = await db.query(
    `UPDATE cotizacion_detalle d
        SET precio_unitario = ROUND(ss.precio::numeric / d.cantidad), subtotal = ss.precio
       FROM solicitud_servicio ss
      WHERE ss.id = d.solicitud_servicio_id AND d.cotizacion_id = $1
        AND ss.estado <> 'Cancelado' AND ss.precio IS NOT NULL
      RETURNING d.subtotal`,
    [cotizacionId],
  );
  return rows.reduce((suma, r) => suma + r.subtotal, 0);
}

/**
 * Cotización emitida pero aún sin aceptar: vuelve a sumar sus líneas (sin
 * interés, que se calcula al aceptar) después de cambiar el precio de un
 * reencauche.
 */
export async function recalcularSinAceptar(db, id) {
  await db.query(
    `UPDATE cotizacion c
        SET subtotal = s.suma, total = s.suma
       FROM (SELECT COALESCE(SUM(subtotal), 0) AS suma FROM cotizacion_detalle WHERE cotizacion_id = $1) s
      WHERE c.id = $1 AND c.metodo_pago IS NULL`,
    [id],
  );
}

/** Estado, método de pago y estado de pago (todo lo que se paga) de una cotización. */
export async function estadoDePago(db, id) {
  const { rows } = await db.query(
    `SELECT c.estado, c.metodo_pago AS "metodoPago", ${SUBCONSULTA_ESTADO_PAGO} AS "estadoPago"
       FROM cotizacion c WHERE c.id = $1`,
    [id],
  );
  return rows[0];
}

/**
 * Lo que falta para cerrar la cotización: sus órdenes de compra que no se
 * han recibido y sus reencauches que no se han completado (los anulados y
 * cancelados no cuentan). → { compras: [números], servicios: [números] }
 */
export async function pendientesParaCompletar(db, id) {
  const compras = await db.query(
    `SELECT numero FROM compra WHERE cotizacion_id = $1 AND estado NOT IN ('Recibida', 'Anulada') ORDER BY id`,
    [id],
  );
  const servicios = await db.query(
    `SELECT ss.numero FROM cotizacion_detalle d JOIN solicitud_servicio ss ON ss.id = d.solicitud_servicio_id
      WHERE d.cotizacion_id = $1 AND ss.estado NOT IN ('Completado', 'Cancelado') ORDER BY ss.id`,
    [id],
  );
  return { compras: compras.rows.map((r) => r.numero), servicios: servicios.rows.map((r) => r.numero) };
}

/**
 * Marca un cambio en la cotización aunque su fila no cambie (un pago
 * revisado, un crédito aprobado, el precio de un reencauche): así sube al
 * primer lugar de "Mis cotizaciones".
 */
export async function marcarCambio(db, id) {
  await db.query('UPDATE cotizacion SET actualizado_en = now() WHERE id = $1', [id]);
}

/** ¿El precio del reencauche ya está dentro del total de su cotización? */
export async function servicioIncluido(db, solicitudId) {
  const { rows } = await db.query(
    'SELECT 1 FROM cotizacion_detalle WHERE solicitud_servicio_id = $1 AND subtotal > 0 LIMIT 1',
    [solicitudId],
  );
  return rows.length > 0;
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
