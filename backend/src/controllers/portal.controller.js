import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { exigirMedioDelCliente } from '../reglas.js';
import { clienteDeSesion } from '../middleware/auth.js';
import * as notificaciones from '../models/notificaciones.model.js';
import * as avisosPersonal from '../models/notificacionesPersonal.model.js';
import * as pagosModel from '../models/pagosCotizacion.model.js';
import * as portalModel from '../models/portal.model.js';
import * as solicitudesModel from '../models/solicitudesServicio.model.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import { PAGO } from '../models/solicitudesServicio.model.js';
import { enviarDato, enviarSinContenido } from '../views/respuesta.view.js';
import { enviarResumen, enviarResumenVacio } from '../views/portal.view.js';

/**
 * Controlador del portal del cliente.
 *
 * El resumen se entrega en una sola respuesta para que el portal cargue de
 * una vez. Un usuario del personal (sin cliente) recibe las listas vacías:
 * puede ver el catálogo, pero no tiene pedidos propios.
 */

/** Cliente en sesión; 403 si es alguien del personal. */
function exigirCliente(req) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) throw new HttpError(403, 'Esta acción es para los clientes del portal.');
  return clienteId;
}

/** GET /portal/resumen */
export async function resumen(req, res) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) return enviarResumenVacio(res);
  enviarResumen(res, {
    cotizaciones: await portalModel.cotizaciones(clienteId),
    lineas: await portalModel.lineasDeCotizaciones(clienteId),
    creditos: await portalModel.creditos(clienteId),
    abonos: await portalModel.abonos(clienteId),
    solicitudesCredito: await portalModel.solicitudesCredito(clienteId),
    pagos: await pagosModel.deCliente(clienteId),
  });
}

/**
 * POST /portal/servicios/:numero/pago — el cliente paga su servicio de
 * reencauche. Queda "En revisión" hasta que un asesor apruebe el pago.
 * Si el pago anterior fue rechazado, así mismo se vuelve a subir.
 */
export async function pagarServicio(req, res) {
  const clienteId = exigirCliente(req);
  const { medioPago, comprobante } = req.validado.body;
  exigirMedioDelCliente(medioPago);
  // En efectivo se paga en el local; con cualquier otro medio hay comprobante
  if (medioPago !== 'Efectivo' && !comprobante) throw new HttpError(422, 'Adjunta el comprobante del pago.');

  await enTransaccion(async (db) => {
    const solicitud = await solicitudesModel.bloquear(db, req.params.numero, clienteId);
    if (!solicitud) throw new HttpError(404, 'El servicio no existe.');
    // Si su precio ya va dentro del total de la cotización, se paga con ella
    if (await cotizacionesModel.servicioIncluido(db, solicitud.id)) {
      throw new HttpError(422, 'Este servicio se paga junto con el total de tu cotización.');
    }
    if (![PAGO.porPagar, PAGO.rechazado].includes(solicitud.pago_estado)) {
      const motivos = {
        [PAGO.sinPrecio]: 'Un asesor aún no le pone valor a este servicio.',
        [PAGO.enRevision]: 'Tu pago ya está en revisión.',
        [PAGO.aprobado]: 'Este servicio ya está pagado.',
      };
      throw new HttpError(422, motivos[solicitud.pago_estado]);
    }
    await solicitudesModel.registrarPago(db, solicitud.id, { medio: medioPago, comprobante: comprobante ?? null });
    await avisosPersonal.crear(
      {
        modulo: 'Solicitudes de servicio',
        titulo: 'Pago de reencauche por revisar',
        mensaje: `${await avisosPersonal.nombreCliente(db, clienteId)} pagó el reencauche ${solicitud.numero} (${medioPago}).`,
        enlace: '/admin/solicitudes-servicio',
      },
      db,
    );
  });

  enviarSinContenido(res);
}

/** GET /portal/notificaciones — las recientes y cuántas faltan por leer. */
export async function listarNotificaciones(req, res) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) return enviarDato(res, { notificaciones: [], sinLeer: 0 });
  enviarDato(res, await notificaciones.listar(clienteId));
}

/** POST /portal/notificaciones/leidas — al abrir la campana. */
export async function marcarLeidas(req, res) {
  await notificaciones.marcarLeidas(exigirCliente(req));
  enviarSinContenido(res);
}

/** DELETE /portal/notificaciones/:id — el cliente borra una notificación. */
export async function borrarNotificacion(req, res) {
  if (!(await notificaciones.borrar(exigirCliente(req), req.validado.params.id))) {
    throw new HttpError(404, 'La notificación no existe o ya la borraste.');
  }
  enviarSinContenido(res);
}

/** DELETE /portal/notificaciones — el cliente borra todas sus notificaciones. */
export async function borrarNotificaciones(req, res) {
  await notificaciones.borrar(exigirCliente(req));
  enviarSinContenido(res);
}

/** GET /portal/notificaciones/por-modulo — avisos sin leer por sección (burbujas del menú). */
export async function notificacionesPorModulo(req, res) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) return enviarDato(res, {});
  enviarDato(res, await notificaciones.porRuta(clienteId));
}

/** POST /portal/notificaciones/vista — el cliente entró a una sección. */
export async function marcarSeccionVista(req, res) {
  await notificaciones.marcarRutaLeida(exigirCliente(req), req.validado.body.ruta);
  enviarSinContenido(res);
}
