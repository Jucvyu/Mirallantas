import { query } from '../db.js';
import { actualizarCampos, consultarListado, POOL } from './listado.model.js';

/**
 * Modelo de solicitudes de servicio de reencauche (tabla `solicitud_servicio`).
 *
 * Además de los datos del reencauche guarda su pago: el precio que asigna
 * el asesor y el pago del cliente (medio, comprobante y su revisión).
 */

/** Estados del pago de un servicio, en el orden en que suceden. */
export const PAGO = {
  sinPrecio: 'Sin precio',
  porPagar: 'Por pagar',
  enRevision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

/** Nombres de la API → columnas que se pueden editar. */
export const COLUMNAS = {
  servicioId: 'servicio_id',
  terceroId: 'tercero_id',
  fecha: 'fecha',
  medidas: 'medidas',
  descripcion: 'descripcion',
  foto: 'foto_url',
  estadoEvidencia: 'estado_evidencia',
  tiempoEstimado: 'tiempo_estimado',
  garantia: 'garantia',
  cantidad: 'cantidad',
};

const SELECT = `
  s.id, s.numero, s.fecha, s.medidas, s.cantidad, s.estado,
  s.estado_evidencia AS "estadoEvidencia", s.garantia, s.tiempo_estimado AS "tiempoEstimado",
  s.descripcion, s.foto_url AS foto,
  s.cliente_id AS "clienteId", cl.nombre_completo AS cliente,
  s.servicio_id AS "servicioId", sv.nombre AS servicio,
  s.tercero_id AS "terceroId", te.nombre_razon_social AS tercero,
  s.precio, s.costo, sv.precio AS "precioSugerido", s.pago_estado AS "pagoEstado", s.pago_medio AS "pagoMedio",
  s.pago_comprobante AS "pagoComprobante", s.pago_fecha AS "pagoFecha", s.pago_motivo AS "pagoMotivo",
  (SELECT c.numero FROM cotizacion_detalle d JOIN cotizacion c ON c.id = d.cotizacion_id
    WHERE d.solicitud_servicio_id = s.id LIMIT 1) AS cotizacion,
  -- Su precio va dentro del total de la cotización (se paga con ella)
  EXISTS (SELECT 1 FROM cotizacion_detalle d WHERE d.solicitud_servicio_id = s.id AND d.subtotal > 0) AS "incluidoEnCotizacion"`;

const DESDE = `
  FROM solicitud_servicio s
  JOIN cliente cl ON cl.id = s.cliente_id
  JOIN servicio sv ON sv.id = s.servicio_id
  LEFT JOIN tercero te ON te.id = s.tercero_id`;

/** Listado con búsqueda, filtros y paginación → { filas, total } */
export function listar(parametros) {
  return consultarListado(
    {
      select: SELECT,
      desde: DESDE,
      buscarEn: ['s.numero', 'cl.nombre_completo', 'sv.nombre'],
      filtros: { estado: 's.estado', estadoEvidencia: 's.estado_evidencia', pagoEstado: 's.pago_estado' },
      columnaCliente: 's.cliente_id',
      orden: 's.fecha DESC, s.id DESC',
    },
    parametros,
  );
}

/** Una solicitud por número, o null. */
export async function buscarPorNumero(numero) {
  const { rows } = await query(`SELECT ${SELECT} ${DESDE} WHERE s.numero = $1`, [numero]);
  return rows[0] ?? null;
}

/**
 * Fila bloqueada (dentro de una transacción) con lo que necesitan las
 * reglas: estado, pago y cliente. Con `clienteId`, solo si es de ese cliente.
 */
export async function bloquear(db, numero, clienteId = null) {
  const { rows } = await db.query(
    `SELECT id, numero, estado, cliente_id, precio, pago_estado
       FROM solicitud_servicio WHERE numero = $1 ${clienteId ? 'AND cliente_id = $2' : ''} FOR UPDATE`,
    clienteId ? [numero, clienteId] : [numero],
  );
  return rows[0] ?? null;
}

/**
 * Crea una solicitud con su número consecutivo (SOL-AAAA-NNN) y devuelve
 * { id, numero }. Los campos que no lleguen toman su valor por defecto.
 */
export async function crear(db, s) {
  const { rows } = await db.query(
    `INSERT INTO solicitud_servicio (numero, cliente_id, servicio_id, tercero_id, fecha, medidas, cantidad,
                                     descripcion, foto_url, estado_evidencia, tiempo_estimado, garantia)
     VALUES (siguiente_numero('SOL'), $1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8,
             COALESCE($9, 'Pendiente de revisión'), $10, COALESCE($11, FALSE))
     RETURNING id, numero`,
    [
      s.clienteId,
      s.servicioId,
      s.terceroId ?? null,
      s.fecha ?? null,
      s.medidas ?? null,
      s.cantidad,
      s.descripcion,
      s.foto ?? null,
      s.estadoEvidencia ?? null,
      s.tiempoEstimado ?? null,
      s.garantia ?? null,
    ],
  );
  return rows[0];
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'solicitud_servicio', id, pares);
}

/**
 * Elimina una solicitud pendiente que NO venga de una cotización (esas se
 * cancelan, no se borran). Devuelve true si la eliminó.
 */
export async function eliminarSuelta(numero, db = POOL) {
  const { rowCount } = await db.query(
    `DELETE FROM solicitud_servicio s
      WHERE s.numero = $1 AND s.estado = 'Pendiente'
        AND NOT EXISTS (SELECT 1 FROM cotizacion_detalle d WHERE d.solicitud_servicio_id = s.id)`,
    [numero],
  );
  return rowCount > 0;
}

/** Elimina una solicitud por id si sigue pendiente (al borrar su cotización). */
export async function eliminarPendiente(db, id) {
  await db.query("DELETE FROM solicitud_servicio WHERE id = $1 AND estado = 'Pendiente'", [id]);
}

/**
 * El cliente pagó la cotización: los reencauches que van dentro de su total
 * quedan pagados con ella (mismo medio, fecha de hoy).
 */
export async function pagarConCotizacion(db, cotizacionId, medio) {
  await db.query(
    `UPDATE solicitud_servicio ss
        SET pago_estado = 'Aprobado', pago_medio = $2, pago_fecha = CURRENT_DATE, pago_motivo = NULL
       FROM cotizacion_detalle d
      WHERE d.solicitud_servicio_id = ss.id AND d.cotizacion_id = $1
        AND d.subtotal > 0 AND ss.pago_estado <> 'Aprobado'`,
    [cotizacionId, medio ?? null],
  );
}

/**
 * Guarda el pago del cliente (medio y comprobante, con la fecha de hoy) y
 * lo deja "En revisión" hasta que el asesor lo apruebe o lo rechace.
 */
export async function registrarPago(db, id, { medio, comprobante = null }) {
  await db.query(
    `UPDATE solicitud_servicio
        SET pago_medio = $2, pago_comprobante = $3, pago_fecha = CURRENT_DATE,
            pago_estado = 'En revisión', pago_motivo = NULL
      WHERE id = $1`,
    [id, medio, comprobante],
  );
}
