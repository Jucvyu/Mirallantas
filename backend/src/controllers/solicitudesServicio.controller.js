import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import { aPares } from '../models/listado.model.js';
import * as avisosPersonal from '../models/notificacionesPersonal.model.js';
import * as notificaciones from '../models/notificaciones.model.js';
import * as solicitudesModel from '../models/solicitudesServicio.model.js';
import { PAGO } from '../models/solicitudesServicio.model.js';
import * as serviciosModel from '../models/servicios.model.js';
import { pesos, SERVICIO_POR_DEFECTO, validarTransicion } from '../reglas.js';
import { enviarDato, enviarLista, enviarSinContenido } from '../views/respuesta.view.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador de solicitudes de servicio de reencauche (personal interno).
 *
 * Nacen solas cuando una cotización incluye un servicio, o las registra el
 * asesor directamente. Aquí se asigna la reencauchadora, se califica la
 * carcasa y se avanza el estado.
 *
 * El servicio se cobra aparte de la cotización:
 *   1. El asesor le pone precio      → pago "Por pagar" (se avisa al cliente).
 *   2. El cliente paga con comprobante → "En revisión" (portal.controller.js).
 *   3. El asesor revisa el pago      → "Aprobado" o "Rechazado" (se avisa).
 *      Rechazado: el cliente vuelve a subir el comprobante.
 * Mientras el pago no esté aprobado, el reencauche no pasa de "Pendiente".
 */

/** Enlace del portal donde el cliente ve sus servicios. */
const EN_PEDIDOS = '/portal/pedidos';

/** Una solicitud por número; 404 si no existe. */
async function leer(numero) {
  const solicitud = await solicitudesModel.buscarPorNumero(numero);
  if (!solicitud) throw new HttpError(404, 'La solicitud no existe.');
  return solicitud;
}

/** GET /solicitudes-servicio */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await solicitudesModel.listar(req.validado.query);
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/** GET /solicitudes-servicio/:numero */
export async function obtener(req, res) {
  enviarDato(res, await leer(req.params.numero));
}

/** POST /solicitudes-servicio */
export async function crear(req, res) {
  const datos = req.validado.body;
  await exigirActivo('cliente', datos.clienteId);
  const solicitud = await enTransaccion(async (db) => {
    // Un solo servicio: "Reencauche" (salvo que llegue otro explícitamente)
    const servicio = await serviciosModel.paraCotizar(db, { id: datos.servicioId, nombre: SERVICIO_POR_DEFECTO });
    if (!servicio?.activo) throw new HttpError(422, 'El servicio de reencauche no está disponible.');
    return solicitudesModel.crear(db, { ...datos, servicioId: servicio.id });
  });
  enviarDato(res, await leer(solicitud.numero), 201);
}

/** PATCH /solicitudes-servicio/:numero */
export async function actualizar(req, res) {
  const { estado, ...resto } = req.validado.body;
  if (resto.servicioId) await exigirActivo('servicio', resto.servicioId);

  await enTransaccion(async (db) => {
    const actual = await solicitudesModel.bloquear(db, req.params.numero);
    if (!actual) throw new HttpError(404, 'La solicitud no existe.');

    const { precio, costo, ...datos } = resto;
    await solicitudesModel.actualizar(db, actual.id, aPares(datos, solicitudesModel.COLUMNAS));
    // El precio de compra es interno: se puede corregir aunque el servicio ya esté pagado
    if (costo !== undefined) await solicitudesModel.actualizar(db, actual.id, [['costo', costo]]);

    // ---- Precio del servicio: solo mientras no se haya pagado
    if (precio !== undefined && precio !== actual.precio) {
      if ([PAGO.enRevision, PAGO.aprobado].includes(actual.pago_estado)) {
        throw new HttpError(422, 'El pago de este servicio ya se registró: su valor no cambia.');
      }
      // Si viene de una cotización, su precio va dentro del total: después de
      // que el cliente la acepta ya no cambia
      const cotizacion = await cotizacionesModel.deSolicitudServicio(db, actual.id);
      // (una cotización de solo reencauche no lo incluye: se sigue cobrando aparte)
      if (cotizacion?.metodoPago && (await cotizacionesModel.servicioIncluido(db, actual.id))) {
        throw new HttpError(422, `La cotización ${cotizacion.numero} ya fue aceptada con este valor: no cambia.`);
      }
      const pagoEstado = actual.pago_estado === PAGO.rechazado ? PAGO.rechazado : PAGO.porPagar;
      await solicitudesModel.actualizar(db, actual.id, [
        ['precio', precio],
        ['pago_estado', pagoEstado],
      ]);
      if (cotizacion?.confirmado && !cotizacion.metodoPago) {
        // Ya emitida (sin aceptar): su línea y su total se actualizan
        await cotizacionesModel.preciarServicios(db, cotizacion.id);
        await cotizacionesModel.recalcularSinAceptar(db, cotizacion.id);
      }
      await notificaciones.crear(
        {
          clienteId: actual.cliente_id,
          titulo: `Tu servicio ${actual.numero} ya tiene valor`,
          mensaje: cotizacion && !cotizacion.metodoPago
            ?`El valor del reencauche es ${pesos(precio)} y se suma al total de tu cotización ${cotizacion.numero}.`
            : `El valor del servicio es ${pesos(precio)}. Ábrelo en "Mis cotizaciones" para pagarlo.`,
          enlace: EN_PEDIDOS,
          tipo: 'alerta',
        },
        db,
      );
      actual.pago_estado = pagoEstado;
    }

    // ---- Estado del reencauche: avanza solo con el pago aprobado
    if (estado && estado !== actual.estado) {
      validarTransicion('servicio', actual.estado, estado);
      if (estado !== 'Cancelado' && actual.pago_estado !== PAGO.aprobado) {
        throw new HttpError(422, 'El reencauche avanza cuando el pago del servicio esté aprobado.');
      }
      await solicitudesModel.actualizar(db, actual.id, [['estado', estado]]);
    }
  });

  enviarDato(res, await leer(req.params.numero));
}

/**
 * POST /solicitudes-servicio/:numero/pago — el asesor aprueba o rechaza el
 * pago. También puede aprobarlo sin comprobante si el cliente pagó en el
 * local (pago "Por pagar").
 */
export async function revisarPago(req, res) {
  const { estado, motivo } = req.validado.body;

  await enTransaccion(async (db) => {
    const actual = await solicitudesModel.bloquear(db, req.params.numero);
    if (!actual) throw new HttpError(404, 'La solicitud no existe.');
    const revisables = estado === 'Aprobado' ? [PAGO.enRevision, PAGO.porPagar] : [PAGO.enRevision];
    if (!revisables.includes(actual.pago_estado)) {
      throw new HttpError(422, `El pago está "${actual.pago_estado}": no se puede ${estado === 'Aprobado' ? 'aprobar' : 'rechazar'}.`);
    }
    if (estado === 'Rechazado' && !motivo) throw new HttpError(422, 'Indica por qué se rechaza el pago.');

    // Aprobado sin comprobante: el cliente pagó en el local, en efectivo
    if (actual.pago_estado === PAGO.porPagar) await solicitudesModel.registrarPago(db, actual.id, { medio: 'Efectivo' });
    await solicitudesModel.actualizar(db, actual.id, [
      ['pago_estado', estado],
      ['pago_motivo', estado === 'Rechazado' ? motivo : null],
    ]);
    await notificaciones.crear(
      estado === 'Aprobado'
        ? {
            clienteId: actual.cliente_id,
            titulo: `Pago aprobado · ${actual.numero}`,
            mensaje: 'Recibimos el pago de tu servicio. Ya puedes seguir el estado del reencauche.',
            enlace: EN_PEDIDOS,
            tipo: 'exito',
          }
        : {
            clienteId: actual.cliente_id,
            titulo: `Pago rechazado · ${actual.numero}`,
            mensaje: `Motivo: ${motivo}. Vuelve a subir el comprobante del pago desde "Mis cotizaciones".`,
            enlace: EN_PEDIDOS,
            tipo: 'alerta',
          },
      db,
    );

    // Con todos los pagos aprobados (productos y servicios), la cotización
    // queda en "Pendiente" con el pago aprobado: lista para que el asesor la
    // procese. Se avisa al personal de Pedidos-Cotización.
    if (estado === 'Aprobado') await cotizacionLista(db, actual.id);
  });

  enviarDato(res, await leer(req.params.numero));
}

/**
 * Si la solicitud viene de una cotización y con este pago quedó todo
 * aprobado, se avisa al personal. La cotización estuvo frenada en
 * "Pendiente" mientras faltaban pagos (la API no la deja avanzar), así que
 * ahora queda en "Pendiente" con el pago aprobado, lista para procesarse.
 * Una que ya avanzó (p. ej. a crédito, aprobada con su solicitud) no se toca.
 */
async function cotizacionLista(db, solicitudId) {
  const cotizacion = await cotizacionesModel.deSolicitudServicio(db, solicitudId);
  if (cotizacion?.estadoPago !== 'Aprobado' || cotizacion.estado !== 'Pendiente') return;
  await avisosPersonal.crear(
    {
      modulo: 'Pedidos-Cotización',
      titulo: 'Pago completo',
      mensaje: `La cotización ${cotizacion.numero} tiene todo el pago aprobado y quedó en "Pendiente".`,
      enlace: '/admin/pedidos-cotizacion',
      tipo: 'exito',
    },
    db,
  );
}

/** DELETE /solicitudes-servicio/:numero — las que vienen de una cotización se cancelan, no se borran. */
export async function eliminar(req, res) {
  if (!(await solicitudesModel.eliminarSuelta(req.params.numero))) {
    throw new HttpError(
      422,
      'Solo se elimina una solicitud pendiente que no venga de una cotización. Las demás se cancelan.',
    );
  }
  enviarSinContenido(res);
}
