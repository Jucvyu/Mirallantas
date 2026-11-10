import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import * as bandasModel from '../models/bandas.model.js';
import * as avisosPersonal from '../models/notificacionesPersonal.model.js';
import * as notificaciones from '../models/notificaciones.model.js';
import * as reencauchesModel from '../models/reencauches.model.js';
import { exigirMedioAceptado, pesos, validarTransicion } from '../reglas.js';
import { enviarDato, enviarLista, enviarTodo } from '../views/respuesta.view.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador del reencauche por banda.
 *
 *   1. El cliente (o el asesor por él) pide el reencauche: banda, medida,
 *      cantidad y dónde revisar las llantas.          → "Por agendar"
 *   2. El asesor agenda la revisión (gratis).         → "Agendada"
 *   3. En la revisión anota cada llanta: si es apta, su banda y su valor
 *      (banda + mano de obra).                         → "Cotizada"
 *      Si ninguna sirve, la solicitud se cierra.       → "Sin llantas aptas"
 *   4. El cliente acepta sin pagar (o no acepta).     → "Aceptada" / "No aceptada"
 *   5. Cada llanta apta es una orden en la reencauchadora:
 *      Por enviar → En planta → Lista para entregar → Entregada.
 *      La planta puede rechazarla: "Rechazada en planta", y no se cobra.
 *   6. Solo se cobra al entregar la llanta terminada.
 */

/** Pantallas a las que llevan los avisos. */
const EN_PORTAL = '/portal/reencauche';
const EN_PANEL = '/admin/reencauches';
const MODULO = 'Reencauche';

/** '2026-11-12' → '12 de noviembre de 2026' (para los avisos). */
const fechaTexto = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const llantasTexto = (n) => `${n} ${n === 1 ? 'llanta' : 'llantas'}`;

/** Una solicitud con sus llantas; 404 si no existe (o no es del cliente). */
async function leer(numero, opciones) {
  const solicitud = await reencauchesModel.detalle(numero, opciones);
  if (!solicitud) throw new HttpError(404, 'La solicitud de reencauche no existe.');
  return solicitud;
}

/** Fila bloqueada para cambiarla; 404 si no existe (o no es del cliente). */
async function bloquear(db, numero, clienteId) {
  const actual = await reencauchesModel.bloquear(db, numero, clienteId);
  if (!actual) throw new HttpError(404, 'La solicitud de reencauche no existe.');
  return actual;
}

/** Cliente en sesión; 403 si es alguien del personal. */
function exigirCliente(req) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) throw new HttpError(403, 'Esta acción es para los clientes del portal.');
  return clienteId;
}

/** La banda existe, está activa y sirve para esa medida de llanta. */
async function exigirBandaCompatible(db, bandaId, medida, prefijo = '') {
  const banda = (await bandasModel.paraRevision(db, [bandaId])).get(bandaId);
  if (!banda) throw new HttpError(422, `${prefijo}La banda seleccionada no existe.`);
  if (!banda.activo) throw new HttpError(422, `${prefijo}${banda.nombre} está inactiva: elige otra banda.`);
  if (!banda.medidas.includes(medida)) {
    throw new HttpError(422, `${prefijo}${banda.nombre} no es compatible con la medida ${medida}.`);
  }
  return banda;
}

/** Solo mientras no se ha revisado se puede cancelar. */
function exigirCancelable(actual) {
  if (!['Por agendar', 'Agendada'].includes(actual.estado)) {
    throw new HttpError(422, `La solicitud está "${actual.estado}": ya no se cancela.`);
  }
}

/** Lo que se dice cuando la cotización ya tiene respuesta. */
const YA_RESPONDIDA = {
  Aceptada: 'El cliente ya aceptó esta cotización',
  'No aceptada': 'El cliente ya respondió que no acepta esta cotización',
};

/**
 * Aceptar o no la cotización. Al aceptar, cada llanta apta queda como orden.
 * Si ya tenía esa misma respuesta (p. ej. el cliente aceptó en el portal
 * mientras el asesor tenía la pantalla abierta) no cambia nada y devuelve
 * null; si la respuesta fue la contraria, lo explica.
 */
async function responder(db, actual, acepta) {
  const estado = acepta ? 'Aceptada' : 'No aceptada';
  if (actual.estado === estado) return null;
  if (actual.estado !== 'Cotizada') {
    throw new HttpError(
      422,
      YA_RESPONDIDA[actual.estado]
        ? `${YA_RESPONDIDA[actual.estado]} (quedó "${actual.estado}"): ya no se puede cambiar.`
        : `La solicitud está "${actual.estado}": no hay una cotización por responder.`,
    );
  }
  validarTransicion('reencauche', actual.estado, estado);
  await reencauchesModel.marcarRespondida(db, actual.id, estado);
  return acepta ? reencauchesModel.abrirOrdenes(db, actual.id) : 0;
}

// =========================================================================
// Personal (/api/reencauches)
// =========================================================================

/** GET /reencauches */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await reencauchesModel.listar(req.validado.query);
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/** GET /reencauches/:numero */
export async function obtener(req, res) {
  enviarDato(res, await leer(req.params.numero));
}

/** POST /reencauches — el asesor registra la solicitud de un cliente (en el local o por teléfono). */
export async function crear(req, res) {
  const datos = req.validado.body;
  await exigirActivo('cliente', datos.clienteId);
  const { numero } = await enTransaccion(async (db) => {
    await exigirBandaCompatible(db, datos.bandaId, datos.medida);
    return reencauchesModel.crear(db, datos);
  });
  enviarDato(res, await leer(numero), 201);
}

/** POST /reencauches/:numero/agenda — fija (o cambia) la fecha de la revisión. */
export async function agendar(req, res) {
  const { fechaRevision } = req.validado.body;
  await enTransaccion(async (db) => {
    const actual = await bloquear(db, req.params.numero);
    if (!['Por agendar', 'Agendada'].includes(actual.estado)) {
      throw new HttpError(422, `La solicitud está "${actual.estado}": la revisión ya no se agenda.`);
    }
    await reencauchesModel.actualizar(db, actual.id, [
      ['fecha_revision', fechaRevision],
      ['estado', 'Agendada'],
    ]);
    await notificaciones.crear(
      {
        clienteId: actual.cliente_id,
        titulo: `Revisión agendada · ${actual.numero}`,
        mensaje: `Revisamos tus llantas el ${fechaTexto(fechaRevision)} ${
          actual.lugar === 'Local' ? 'en el local' : 'en tu dirección'
        }. La revisión es gratis.`,
        enlace: EN_PORTAL,
      },
      db,
    );
  });
  enviarDato(res, await leer(req.params.numero));
}

/**
 * POST /reencauches/:numero/revision — lo que encontró el asesor en cada
 * llanta. Mientras el cliente no responda se puede corregir.
 */
export async function registrarRevision(req, res) {
  const { llantas } = req.validado.body;
  await enTransaccion(async (db) => {
    const actual = await bloquear(db, req.params.numero);
    if (actual.estado === 'Por agendar') throw new HttpError(422, 'Primero agenda la revisión.');
    if (!['Agendada', 'Cotizada'].includes(actual.estado)) {
      throw new HttpError(422, `La solicitud está "${actual.estado}": su revisión ya no cambia.`);
    }

    // Cada llanta apta lleva una banda activa y compatible con su medida.
    // Si no llega el precio de la banda, se toma el del catálogo.
    const aptas = llantas.filter((l) => l.resultado === 'Apta');
    const bandas = await bandasModel.paraRevision(db, [...new Set(aptas.map((l) => l.bandaId))]);
    const revisadas = llantas.map((l, i) => {
      if (l.resultado !== 'Apta') return l;
      const banda = bandas.get(l.bandaId);
      const llanta = `Llanta ${i + 1}: `;
      if (!banda) throw new HttpError(422, `${llanta}la banda seleccionada no existe.`);
      if (!banda.activo) throw new HttpError(422, `${llanta}${banda.nombre} está inactiva: elige otra banda.`);
      if (!banda.medidas.includes(l.medida)) {
        throw new HttpError(422, `${llanta}${banda.nombre} no es compatible con la medida ${l.medida}.`);
      }
      return { ...l, precioBanda: l.precioBanda ?? banda.precio };
    });

    const estado = aptas.length ? 'Cotizada' : 'Sin llantas aptas';
    validarTransicion('reencauche', actual.estado, estado);
    await reencauchesModel.reemplazarLlantas(db, actual.id, revisadas);
    await reencauchesModel.marcarRevisada(db, actual.id, req.usuario.id, estado, llantas.length);

    const total = revisadas.filter((l) => l.resultado === 'Apta').reduce((s, l) => s + l.precioBanda + l.manoObra, 0);
    await notificaciones.crear(
      aptas.length
        ? {
            clienteId: actual.cliente_id,
            titulo: `Tu cotización de reencauche está lista · ${actual.numero}`,
            mensaje: `${aptas.length} de ${llantasTexto(llantas.length)} sirven para reencauche, por ${pesos(total)}. Acéptala en el portal: no pagas nada hasta recibirlas.`,
            enlace: EN_PORTAL,
            tipo: 'alerta',
          }
        : {
            clienteId: actual.cliente_id,
            titulo: `Revisamos tus llantas · ${actual.numero}`,
            mensaje: 'Ninguna llanta sirve para reencauche. Te las devolvemos sin ningún costo.',
            enlace: EN_PORTAL,
          },
      db,
    );
  });
  enviarDato(res, await leer(req.params.numero));
}

/** POST /reencauches/:numero/respuesta — el cliente responde en el local. */
export async function responderEnLocal(req, res) {
  await enTransaccion(async (db) => {
    const actual = await bloquear(db, req.params.numero);
    const ordenes = await responder(db, actual, req.validado.body.acepta);
    if (ordenes) {
      await notificaciones.crear(
        {
          clienteId: actual.cliente_id,
          titulo: `Reencauche aceptado · ${actual.numero}`,
          mensaje: `${llantasTexto(ordenes)} van a la reencauchadora. Pagas cada una cuando la recibas.`,
          enlace: EN_PORTAL,
          tipo: 'exito',
        },
        db,
      );
    }
  });
  enviarDato(res, await leer(req.params.numero));
}

/** POST /reencauches/:numero/cancelar — antes de la revisión, con motivo. */
export async function cancelar(req, res) {
  const { motivo } = req.validado.body;
  await enTransaccion(async (db) => {
    const actual = await bloquear(db, req.params.numero);
    exigirCancelable(actual);
    await reencauchesModel.actualizar(db, actual.id, [
      ['estado', 'Cancelada'],
      ['motivo_cancelacion', motivo],
    ]);
    await notificaciones.crear(
      {
        clienteId: actual.cliente_id,
        titulo: `Solicitud cancelada · ${actual.numero}`,
        mensaje: `Motivo: ${motivo}`,
        enlace: EN_PORTAL,
        tipo: 'alerta',
      },
      db,
    );
  });
  enviarDato(res, await leer(req.params.numero));
}

// ---- Órdenes en la reencauchadora -------------------------------------------

/** GET /reencauches/ordenes */
export async function listarOrdenes(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await reencauchesModel.listarOrdenes(req.validado.query);
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/**
 * Pasa una orden a `siguiente` si el flujo lo permite y ejecuta `trabajo`
 * dentro de la misma transacción. Responde la orden actualizada.
 */
async function cambiarOrden(req, res, siguiente, trabajo) {
  const id = req.validado.params.id;
  await enTransaccion(async (db) => {
    const actual = await reencauchesModel.bloquearOrden(db, id);
    if (!actual) throw new HttpError(404, 'La orden de reencauche no existe.');
    if (actual.estado === siguiente) throw new HttpError(422, `La llanta ya está "${siguiente}".`);
    validarTransicion('ordenReencauche', actual.estado, siguiente);
    await trabajo(db, actual);
  });
  enviarDato(res, await reencauchesModel.orden(id));
}

/** Nombre de la llanta en los avisos: "llanta LL-0145 (REE-2026-001)". */
const llantaDe = (o) => `llanta ${o.identificador} (${o.numero})`;

/** POST /reencauches/ordenes/:id/envio — sale hacia la reencauchadora. */
export function enviarOrden(req, res) {
  const { terceroId } = req.validado.body;
  return cambiarOrden(req, res, 'En planta', async (db, orden) => {
    await exigirActivo('tercero', terceroId, db);
    await reencauchesModel.registrarEnvio(db, orden.id, terceroId);
  });
}

/** POST /reencauches/ordenes/:id/lista — la planta la devolvió reencauchada. */
export function marcarLista(req, res) {
  return cambiarOrden(req, res, 'Lista para entregar', async (db, orden) => {
    await reencauchesModel.actualizarOrden(db, orden.id, [['estado', 'Lista para entregar']]);
    await notificaciones.crear(
      {
        clienteId: orden.cliente_id,
        titulo: `Tu llanta está lista · ${llantaDe(orden)}`,
        mensaje: `Ya está reencauchada. Pagas ${pesos(orden.valor)} cuando la recibas.`,
        enlace: EN_PORTAL,
        tipo: 'exito',
      },
      db,
    );
  });
}

/** POST /reencauches/ordenes/:id/rechazo — la planta no pudo reencaucharla: no se cobra. */
export function rechazarEnPlanta(req, res) {
  const { motivo } = req.validado.body;
  return cambiarOrden(req, res, 'Rechazada en planta', async (db, orden) => {
    await reencauchesModel.actualizarOrden(db, orden.id, [
      ['estado', 'Rechazada en planta'],
      ['motivo_planta', motivo],
    ]);
    await notificaciones.crear(
      {
        clienteId: orden.cliente_id,
        titulo: `La reencauchadora no pudo reencauchar tu llanta · ${llantaDe(orden)}`,
        mensaje: `Motivo: ${motivo}. Esta llanta no se cobra y te la devolvemos.`,
        enlace: EN_PORTAL,
        tipo: 'alerta',
      },
      db,
    );
  });
}

/**
 * POST /reencauches/ordenes/:id/entrega — se entrega y se cobra (el único
 * cobro). Por transferencia se adjunta el pantallazo de la consignación.
 */
export function entregarOrden(req, res) {
  const { medioPago, comprobante } = req.validado.body;
  exigirMedioAceptado(medioPago);
  if (medioPago === 'Transferencia' && !comprobante) throw new HttpError(422, 'Adjunta el comprobante de la transferencia.');
  return cambiarOrden(req, res, 'Entregada', async (db, orden) => {
    await reencauchesModel.registrarEntrega(db, orden.id, {
      medio: medioPago,
      comprobante: medioPago === 'Transferencia' ? comprobante : null,
      usuarioId: req.usuario.id,
    });
    await notificaciones.crear(
      {
        clienteId: orden.cliente_id,
        titulo: `Llanta entregada · ${llantaDe(orden)}`,
        mensaje: `Recibimos tu pago de ${pesos(orden.valor)} (${medioPago.toLowerCase()}). ¡Gracias!`,
        enlace: EN_PORTAL,
        tipo: 'exito',
      },
      db,
    );
  });
}

// =========================================================================
// Portal del cliente (/api/portal/…)
// =========================================================================

/** GET /portal/bandas — las bandas que se ofrecen (sin precio: se cotiza al revisar). */
export async function bandasPortal(req, res) {
  enviarTodo(res, await bandasModel.activasParaPortal());
}

/** GET /portal/reencauches — las solicitudes del cliente con sus llantas. */
export async function misReencauches(req, res) {
  const clienteId = clienteDeSesion(req);
  enviarTodo(res, clienteId ? await reencauchesModel.deCliente(clienteId) : []);
}

/** Aviso para quien tenga el módulo Reencauche. */
async function avisarPersonal(db, clienteId, { titulo, mensaje, tipo = 'info' }) {
  const nombre = await avisosPersonal.nombreCliente(db, clienteId);
  await avisosPersonal.crear({ modulo: MODULO, titulo, mensaje: `${nombre} ${mensaje}`, enlace: EN_PANEL, tipo }, db);
}

/** POST /portal/reencauches — el cliente pide el reencauche. */
export async function solicitarDesdePortal(req, res) {
  const clienteId = exigirCliente(req);
  const datos = { ...req.validado.body, clienteId };
  await exigirActivo('cliente', clienteId);
  const numero = await enTransaccion(async (db) => {
    const banda = await exigirBandaCompatible(db, datos.bandaId, datos.medida);
    const creada = await reencauchesModel.crear(db, datos);
    await avisarPersonal(db, clienteId, {
      titulo: `Nueva solicitud de reencauche · ${creada.numero}`,
      mensaje: `pidió revisar ${llantasTexto(datos.cantidad)} ${datos.medida} con ${banda.nombre}. Agenda la revisión.`,
      tipo: 'alerta',
    });
    return creada.numero;
  });
  enviarDato(res, await leer(numero, { clienteId }), 201);
}

/** POST /portal/reencauches/:numero/respuesta — aceptar (sin pagar) o no la cotización. */
export async function responderDesdePortal(req, res) {
  const clienteId = exigirCliente(req);
  const { acepta } = req.validado.body;
  await enTransaccion(async (db) => {
    const actual = await bloquear(db, req.params.numero, clienteId);
    const ordenes = await responder(db, actual, acepta);
    // Ya tenía esa respuesta: no se repite el aviso
    if (ordenes === null) return;
    await avisarPersonal(db, clienteId, acepta
      ? {
          titulo: `Reencauche aceptado · ${actual.numero}`,
          mensaje: `aceptó la cotización: ${llantasTexto(ordenes)} por enviar a la reencauchadora.`,
          tipo: 'exito',
        }
      : { titulo: `Cotización no aceptada · ${actual.numero}`, mensaje: 'no aceptó la cotización. Devuelve sus llantas.' });
  });
  enviarDato(res, await leer(req.params.numero, { clienteId }));
}

/** POST /portal/reencauches/:numero/cancelar — antes de la revisión. */
export async function cancelarDesdePortal(req, res) {
  const clienteId = exigirCliente(req);
  const motivo = req.validado.body.motivo ?? 'El cliente canceló la solicitud.';
  await enTransaccion(async (db) => {
    const actual = await bloquear(db, req.params.numero, clienteId);
    exigirCancelable(actual);
    await reencauchesModel.actualizar(db, actual.id, [
      ['estado', 'Cancelada'],
      ['motivo_cancelacion', motivo],
    ]);
    await avisarPersonal(db, clienteId, { titulo: `Solicitud cancelada · ${actual.numero}`, mensaje: 'canceló la solicitud de reencauche.' });
  });
  enviarDato(res, await leer(req.params.numero, { clienteId }));
}
