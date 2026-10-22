import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import * as abonosModel from '../models/abonos.model.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import * as creditosModel from '../models/creditos.model.js';
import * as notificaciones from '../models/notificaciones.model.js';
import { POOL } from '../models/listado.model.js';
import * as solicitudesModel from '../models/solicitudesCredito.model.js';
import * as solicitudesServicioModel from '../models/solicitudesServicio.model.js';
import { validarTransicion } from '../reglas.js';
import { enviarDato, enviarLista, enviarSinContenido } from '../views/respuesta.view.js';
import { exigirSinCreditoAbierto } from './creditos.controller.js';
import { exigirActivo } from './estados.js';
import { generarCompras, registrarVentaPagada, sincronizarVenta } from './documentosAutomaticos.js';

/**
 * Controlador de solicitudes de crédito.
 *
 * Una cotización-pedido a crédito crea su solicitud (Pendiente). El asesor
 * revisa el detalle y la consignación de la cuota inicial y la aprueba o no:
 *
 *   Aprobada  → se abre el crédito en la cartera del cliente por el total,
 *               la cuota inicial queda como su primer abono (confirmado) y
 *               la cotización pasa a "Aprobada". El saldo usable del
 *               cliente baja en lo que queda debiendo.
 *   Rechazada → la cotización se rechaza.
 *
 * También existen solicitudes sueltas (monto y plazo, sin cotización) que
 * crea un asesor: al aprobarlas se abre el crédito por ese monto.
 */

/** GET /solicitudes-credito — el portal solo ve las suyas. */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await solicitudesModel.listar({ ...req.validado.query, clienteId: clienteDeSesion(req) });
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/** POST /solicitudes-credito */
export async function crear(req, res) {
  const datos = req.validado.body;
  const clienteId = clienteDeSesion(req) ?? datos.clienteId;
  if (!clienteId) throw new HttpError(422, 'Selecciona el cliente.');

  await exigirActivo('cliente', clienteId);
  // Sin tope de monto: solo se exige no tener otro crédito abierto
  await exigirSinCreditoAbierto(POOL, clienteId);

  const numero = await solicitudesModel.crear({ clienteId, monto: datos.monto, plazoDias: datos.plazoDias });
  enviarDato(res, await solicitudesModel.buscarPorNumero(numero), 201);
}

/** GET /solicitudes-credito/:numero — con el detalle de su cotización y la consignación. */
export async function obtener(req, res) {
  const solicitud = await solicitudesModel.buscarPorNumero(req.params.numero, clienteDeSesion(req));
  if (!solicitud) throw new HttpError(404, 'La solicitud no existe.');
  let detalle = [];
  if (solicitud.cotizacion) {
    const cotizacion = await cotizacionesModel.buscarPorNumero(solicitud.cotizacion);
    detalle = await cotizacionesModel.lineas(cotizacion.id);
    solicitud.metodoPago = cotizacion.metodoPago;
    solicitud.interes = cotizacion.interes;
    solicitud.subtotal = cotizacion.subtotal;
  }
  enviarDato(res, { ...solicitud, detalle });
}

/** Aprobar la solicitud de una cotización: crédito + cuota inicial + cotización aprobada. */
async function aprobarDeCotizacion(db, solicitud) {
  const cotizacion = await cotizacionesModel.fila(db, solicitud.cotizacion_id);
  if (cotizacion.estado !== 'Pendiente') {
    throw new HttpError(422, `La cotización ${cotizacion.numero} está "${cotizacion.estado}": ya no se puede aprobar.`);
  }
  const numero = await creditosModel.crear(db, {
    clienteId: cotizacion.cliente_id,
    cotizacionId: cotizacion.id,
    montoTotal: cotizacion.total,
    plazoDias: cotizacion.plazo_dias,
  });
  // La cuota inicial ya se pagó (la consignación que revisó el asesor)
  if (cotizacion.cuota_inicial > 0) {
    const credito = await creditosModel.buscarPorNumero(numero, {}, db);
    await abonosModel.crear(db, {
      creditoId: credito.id,
      monto: cotizacion.cuota_inicial,
      medioPago: cotizacion.cuota_inicial_medio ?? 'Efectivo',
      comprobante: cotizacion.cuota_inicial_comprobante,
      estado: 'Confirmado',
    });
    await creditosModel.descontarSaldo(db, credito.id, cotizacion.cuota_inicial);
  }
  await cotizacionesModel.actualizar(db, cotizacion.id, [['estado', 'Aprobada']]);
  // Pagó la cuota inicial y se le financió el resto: el reencauche (dentro del
  // total) queda pagado con la cotización; venta y compra al proveedor
  await solicitudesServicioModel.pagarConCotizacion(db, cotizacion.id, cotizacion.cuota_inicial_medio);
  await registrarVentaPagada(db, cotizacion.id);
  await generarCompras(db, cotizacion.id);
}

/** No aprobar la solicitud de una cotización: la cotización se rechaza. */
async function rechazarDeCotizacion(db, solicitud, motivo) {
  const cotizacion = await cotizacionesModel.fila(db, solicitud.cotizacion_id);
  if (['Pendiente', 'Aprobada'].includes(cotizacion.estado)) {
    await cotizacionesModel.actualizar(db, cotizacion.id, [
      ['estado', 'Rechazada'],
      ['motivo_cancelacion', `Crédito no aprobado: ${motivo}`],
    ]);
    await sincronizarVenta(db, cotizacion.id);
  }
}

/** PATCH /solicitudes-credito/:numero — aprobar o rechazar. */
export async function revisar(req, res) {
  const { estado, motivo } = req.validado.body;

  await enTransaccion(async (db) => {
    const solicitud = await solicitudesModel.bloquear(db, req.params.numero);
    if (!solicitud) throw new HttpError(404, 'La solicitud no existe.');
    validarTransicion('solicitudCredito', solicitud.estado, estado);

    if (estado === 'Rechazada' && !motivo) throw new HttpError(422, 'Indica el motivo del rechazo.');

    // Al aprobarla se abre el crédito en la cartera
    if (estado === 'Aprobada') {
      await exigirSinCreditoAbierto(db, solicitud.cliente_id);
      if (solicitud.cotizacion_id) {
        await aprobarDeCotizacion(db, solicitud);
      } else {
        await creditosModel.crear(db, {
          clienteId: solicitud.cliente_id,
          montoTotal: solicitud.monto,
          plazoDias: solicitud.plazo_dias,
        });
      }
    }
    if (estado === 'Rechazada' && solicitud.cotizacion_id) await rechazarDeCotizacion(db, solicitud, motivo);
    await solicitudesModel.resolver(db, solicitud.id, { estado, motivo: estado === 'Rechazada' ? motivo : null });
    await notificaciones.crear(
      estado === 'Aprobada'
        ? {
            clienteId: solicitud.cliente_id,
            titulo: `Crédito aprobado · ${solicitud.numero}`,
            mensaje: 'Tu crédito ya aparece en "Mi cartera". Desde allí puedes registrar tus abonos.',
            enlace: '/portal/cartera',
            tipo: 'exito',
          }
        : {
            clienteId: solicitud.cliente_id,
            titulo: `Crédito no aprobado · ${solicitud.numero}`,
            mensaje: `Motivo: ${motivo}.`,
            enlace: '/portal/cartera',
            tipo: 'alerta',
          },
      db,
    );
  });

  enviarDato(res, await solicitudesModel.buscarPorNumero(req.params.numero));
}

/** DELETE /solicitudes-credito/:numero — solo si sigue pendiente. */
export async function eliminar(req, res) {
  if (!(await solicitudesModel.eliminarPendiente(req.params.numero))) {
    throw new HttpError(422, 'Solo se elimina una solicitud pendiente.');
  }
  enviarSinContenido(res);
}
