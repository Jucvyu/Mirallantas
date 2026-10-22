import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import { claveIdempotencia } from '../middleware/idempotencia.js';
import * as clientesModel from '../models/clientes.model.js';
import * as empresaModel from '../models/empresa.model.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import { aPares } from '../models/listado.model.js';
import * as productosModel from '../models/productos.model.js';
import * as notificaciones from '../models/notificaciones.model.js';
import * as avisosPersonal from '../models/notificacionesPersonal.model.js';
import * as pagosModel from '../models/pagosCotizacion.model.js';
import * as serviciosModel from '../models/servicios.model.js';
import * as solicitudesCreditoModel from '../models/solicitudesCredito.model.js';
import * as solicitudesModel from '../models/solicitudesServicio.model.js';
import {
  calcularTotales,
  CUOTA_INICIAL_PORCENTAJE,
  exigirMedioDelCliente,
  pesos,
  PLAZOS_CREDITO,
  SERVICIO_POR_DEFECTO,
  validarTransicion,
  VIGENCIA_COTIZACION_DIAS,
} from '../reglas.js';
import { enviarDocumento, enviarDocumentos } from '../views/documentos.view.js';
import { enviarPdfCotizacion } from '../views/pdf.view.js';
import { enviarSinContenido } from '../views/respuesta.view.js';
import { exigirActivo } from './estados.js';
import { completarVenta, generarCompras, registrarVentaPagada } from './documentosAutomaticos.js';

/**
 * Controlador de cotizaciones-pedido. El flujo comercial tiene tres pasos:
 *
 *   1. Solicitud (crear): el cliente del portal, o el asesor por él, pide
 *      llantas y cantidades. No lleva precios ni método de pago: el precio
 *      definitivo se confirma después con el proveedor. Los servicios de
 *      reencauche abren su solicitud de servicio, como siempre.
 *   2. Cotización formal (emitir): el asesor verifica con el proveedor cada
 *      llanta, fija el precio de venta y la emite. Vence a los 8 días
 *      calendario. Un precio nunca se da por verificado sin que el asesor
 *      lo registre.
 *   3. Aceptación (aceptar): dentro de la vigencia, el cliente elige
 *      contado (sube el pago) o crédito (plazo + cuota inicial del 30 %, que
 *      abre su solicitud de crédito). Desde aquí sigue el pedido de siempre.
 *
 * - Los precios nunca vienen del navegador del cliente.
 * - El aplicativo no maneja stock: pedir llantas no reserva existencias.
 * - El pedido no avanza hasta que todo su pago esté aprobado (ver actualizar).
 * - Al pasar a "Completada" se genera la venta en la misma transacción.
 */

/** Cotización completa (cabecera + líneas), respetando el alcance del portal. */
async function leerCompleta(req, numero, db) {
  const cotizacion = await cotizacionesModel.buscarPorNumero(numero, { clienteId: clienteDeSesion(req) }, db);
  return {
    ...cotizacion,
    detalle: await cotizacionesModel.lineas(cotizacion.id, db),
    // Consignaciones del pago de contado, de la más nueva a la más vieja
    pagos: await pagosModel.deCotizacion(cotizacion.id, db),
  };
}

/**
 * Al aceptar una cotización (desde el portal o en el local) y al volver a
 * subir su pago solo se admite efectivo o transferencia: tarjeta y "otro"
 * no están habilitados en este flujo.
 */
function exigirMedioDelPortal(medio) {
  exigirMedioDelCliente(medio);
}

/** Pago de contado: con qué medio y, salvo en efectivo, con su consignación. */
function exigirPagoContado(pago, esPortal) {
  if (!pago?.medioPago) throw new HttpError(422, 'Indica cómo vas a pagar.');
  exigirMedioDelPortal(pago.medioPago, esPortal);
  if (pago.medioPago !== 'Efectivo' && !pago.comprobante) {
    throw new HttpError(422, 'Adjunta la consignación del pago.');
  }
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** GET /cotizaciones — el portal solo ve las suyas. */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const clienteId = clienteDeSesion(req);
  const resultado = await cotizacionesModel.listar({ ...req.validado.query, clienteId });
  enviarDocumentos(res, { ...resultado, pagina, porPagina }, Boolean(clienteId));
}

/** GET /cotizaciones/:numero — con sus líneas. */
export async function obtener(req, res) {
  enviarDocumento(res, await leerCompleta(req, req.params.numero), Boolean(clienteDeSesion(req)));
}

/**
 * GET /cotizaciones/:numero/pdf — la cotización formal en PDF. Una
 * solicitud todavía no tiene precios confirmados: no hay documento.
 */
export async function pdf(req, res) {
  const cotizacion = await cotizacionesModel.buscarPorNumero(req.params.numero, { clienteId: clienteDeSesion(req) });
  if (!cotizacion.emitidaEn) {
    throw new HttpError(422, 'La cotización formal todavía no se ha emitido: los precios están por confirmar.');
  }
  const [lineas, cliente, empresa] = await Promise.all([
    cotizacionesModel.lineas(cotizacion.id),
    clientesModel.paraDocumento(cotizacion.clienteId),
    empresaModel.obtener(),
  ]);
  enviarPdfCotizacion(res, { empresa, cotizacion, cliente, lineas });
}

// ---------------------------------------------------------------------------
// 1. Solicitud
// ---------------------------------------------------------------------------

/**
 * Completa cada línea con los datos del catálogo (nombre y medida). Las
 * llantas quedan sin precio hasta la cotización formal; los servicios, en
 * 0 (se cobran aparte). Lanza 422 si algo no existe o no está disponible.
 */
async function lineasDelCatalogo(db, lineasPedidas) {
  const lineas = [];
  for (const linea of lineasPedidas) {
    if (linea.tipo === 'producto') {
      const producto = await productosModel.paraCotizar(db, linea.productoId);
      if (!producto?.activo) throw new HttpError(422, 'Uno de los productos no existe o ya no está a la venta.');
      lineas.push({ ...linea, descripcion: producto.nombre, medida: producto.medidas, precioUnitario: null });
    } else {
      const servicio = await serviciosModel.paraCotizar(db, { id: linea.servicioId, nombre: SERVICIO_POR_DEFECTO });
      if (!servicio?.activo) throw new HttpError(422, 'El servicio no existe o no está disponible.');
      lineas.push({
        ...linea,
        servicioId: servicio.id,
        descripcionServicio: servicio.nombre,
        medida: linea.medidas ?? null,
        // El servicio no se cobra en la cotización: el asesor le pone precio
        // en "Solicitudes de servicio" y el cliente lo paga aparte
        precioUnitario: 0,
      });
    }
  }
  return lineas;
}

/** Una misma llanta pedida dos veces se junta en una sola línea. */
function juntarRepetidas(lineas) {
  const juntas = [];
  for (const linea of lineas) {
    const igual = linea.tipo === 'producto' && juntas.find((l) => l.tipo === 'producto' && l.productoId === linea.productoId);
    if (igual) igual.cantidad += linea.cantidad;
    else juntas.push({ ...linea });
  }
  return juntas;
}

/** POST /cotizaciones — registra la solicitud (sin precios ni método de pago). */
export async function crear(req, res) {
  const datos = req.validado.body;
  const esPortal = Boolean(clienteDeSesion(req));
  const clienteId = esPortal ? clienteDeSesion(req) : datos.clienteId;
  if (!clienteId) throw new HttpError(422, 'Selecciona el cliente de la cotización.');

  const clave = claveIdempotencia(req);
  let repetida = false;

  const numero = await enTransaccion(async (db) => {
    // Petición repetida (doble clic, reintento): se devuelve la que ya existe
    const existente = clave && (await cotizacionesModel.numeroPorClave(db, clienteId, clave));
    if (existente) {
      repetida = true;
      return existente;
    }
    if (!(await clientesModel.estaActivo(db, clienteId))) {
      throw new HttpError(422, 'El cliente no existe o está inactivo.');
    }

    const lineas = await lineasDelCatalogo(db, juntarRepetidas(datos.lineas));
    // Solo con llantas hay precios que confirmar. Una solicitud de puro
    // reencauche no lleva cotización formal: su valor y su pago van en
    // "Solicitudes de servicio".
    const conProductos = lineas.some((l) => l.tipo === 'producto');

    const cotizacion = await cotizacionesModel.crear(db, {
      clienteId,
      proveedorId: esPortal ? null : datos.proveedorId,
      metodoPago: conProductos ? null : 'Contado',
      confirmado: !conProductos,
      direccionEntrega: datos.direccionEntrega,
      claveIdempotencia: clave,
    });

    // Líneas. Cada servicio abre su solicitud de reencauche
    for (const l of lineas) {
      let solicitudServicioId = null;
      if (l.tipo === 'servicio') {
        const solicitud = await solicitudesModel.crear(db, {
          clienteId,
          servicioId: l.servicioId,
          medidas: l.medida,
          cantidad: l.cantidad,
          descripcion: l.descripcion,
          foto: l.foto,
          estadoEvidencia: esPortal ? 'Pendiente de revisión' : (l.estadoEvidencia ?? 'Pendiente de revisión'),
        });
        solicitudServicioId = solicitud.id;
      }
      await cotizacionesModel.crearLinea(db, cotizacion.id, {
        ...l,
        productoId: l.tipo === 'producto' ? l.productoId : null,
        servicioId: l.tipo === 'servicio' ? l.servicioId : null,
        solicitudServicioId,
        descripcion: l.tipo === 'producto' ? l.descripcion : l.descripcionServicio,
      });
    }

    // Si la pidió el cliente desde el portal, se avisa al personal
    if (esPortal) {
      const cliente = await avisosPersonal.nombreCliente(db, clienteId);
      await avisosPersonal.crear(
        {
          modulo: 'Pedidos-Cotización',
          titulo: conProductos ? 'Nueva solicitud de cotización' : 'Nueva solicitud de reencauche',
          mensaje: conProductos
            ? `${cliente} pidió la cotización ${cotizacion.numero}: confirma los precios con el proveedor (plazo de respuesta: 24 horas).`
            : `${cliente} pidió un reencauche (${cotizacion.numero}).`,
          enlace: '/admin/pedidos-cotizacion',
        },
        db,
      );
    }
    return cotizacion.numero;
  });

  enviarDocumento(res, await leerCompleta(req, numero), esPortal, repetida ? 200 : 201);
}

// ---------------------------------------------------------------------------
// 2. Cotización formal (solo personal)
// ---------------------------------------------------------------------------

/**
 * POST /cotizaciones/:numero/emitir — el asesor registra, para cada llanta,
 * el proveedor, el costo que este le confirmó y el precio de venta, y emite
 * la cotización formal con su vigencia. Se puede volver a emitir (p. ej. si
 * venció) mientras el cliente no la haya aceptado; los precios de una
 * cotización emitida no cambian si después cambia el catálogo.
 */
export async function emitir(req, res) {
  const { lineas: confirmadas } = req.validado.body;

  await enTransaccion(async (db) => {
    const cotizacion = await cotizacionesModel.buscarPorNumero(req.params.numero, { bloquear: 'c' }, db);
    if (cotizacion.estado !== 'Pendiente') {
      throw new HttpError(422, `La cotización está "${cotizacion.estado}": ya no se puede emitir.`);
    }
    if (cotizacion.metodoPago) throw new HttpError(422, 'El cliente ya aceptó esta cotización: sus precios no cambian.');

    const productos = (await cotizacionesModel.lineas(cotizacion.id, db)).filter((l) => l.tipo === 'producto');
    if (productos.length === 0) throw new HttpError(422, 'La cotización no tiene llantas que cotizar.');

    let subtotal = 0;
    for (const linea of productos) {
      const datos = confirmadas.find((c) => c.id === linea.id);
      if (!datos) throw new HttpError(422, `Confirma el precio de "${linea.descripcion}" antes de emitir.`);
      await exigirActivo('proveedor', datos.proveedorId, db);
      await cotizacionesModel.confirmarLinea(db, linea.id, { ...datos, usuarioId: req.usuario.id });
      subtotal += datos.precioUnitario * linea.cantidad;
    }
    const sobrantes = confirmadas.filter((c) => !productos.some((l) => l.id === c.id));
    if (sobrantes.length > 0) throw new HttpError(422, 'Una de las líneas no es una llanta de esta cotización.');

    await cotizacionesModel.emitir(db, cotizacion.id, { subtotal, dias: VIGENCIA_COTIZACION_DIAS });
    await notificaciones.crear(
      {
        clienteId: cotizacion.clienteId,
        titulo: `Tu cotización está lista · ${cotizacion.numero}`,
        mensaje: `Confirmamos los precios: ${pesos(subtotal)}. La cotización es válida por ${VIGENCIA_COTIZACION_DIAS} días; acéptala desde "Mis cotizaciones".`,
        enlace: '/portal/pedidos',
        tipo: 'exito',
      },
      db,
    );
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero));
}

// ---------------------------------------------------------------------------
// 3. Aceptación (cliente del portal o asesor en el local)
// ---------------------------------------------------------------------------

/**
 * Reglas del crédito al aceptar. Devuelve la cuota inicial que se guarda:
 * la pagada, que debe cubrir al menos el 30 % del total definitivo.
 */
async function validarCredito(db, { clienteId, total, cuotaMinima, cuota, esPortal }) {
  const abierto = await clientesModel.creditoAbierto(db, clienteId);
  if (abierto) {
    throw new HttpError(422, `El cliente ya tiene el crédito ${abierto} abierto: solo se permite uno a la vez.`);
  }
  const pendiente = await solicitudesCreditoModel.pendienteDeCliente(db, clienteId);
  if (pendiente) {
    throw new HttpError(422, `El cliente ya tiene la solicitud de crédito ${pendiente} en revisión.`);
  }
  if (!cuota?.medioPago) throw new HttpError(422, 'Registra el pago de la cuota inicial (medio de pago).');
  exigirMedioDelPortal(cuota.medioPago, esPortal);
  const cuotaInicial = cuota.monto ?? cuotaMinima;
  if (cuotaInicial < cuotaMinima) {
    throw new HttpError(
      422,
      `La cuota inicial debe ser de al menos ${pesos(cuotaMinima)} (${CUOTA_INICIAL_PORCENTAJE} % del total).`,
    );
  }
  if (cuotaInicial >= total) throw new HttpError(422, 'Si se paga todo de una vez, elige pago de contado.');
  // En efectivo se paga en el local; con cualquier otro medio hay pantallazo
  if (cuota.medioPago !== 'Efectivo' && !cuota.comprobante) {
    throw new HttpError(422, 'Adjunta el comprobante del pago de la cuota inicial.');
  }
  return cuotaInicial;
}

/**
 * POST /portal/cotizaciones/:numero/aceptar (cliente) y
 * POST /cotizaciones/:numero/aceptar (asesor, por el cliente en el local).
 *
 * Solo una cotización formal vigente. De contado, queda la consignación en
 * revisión; a crédito se suma el interés del plazo y se abre la solicitud
 * de crédito por lo que se financia (el 70 % o menos).
 */
export async function aceptar(req, res) {
  const datos = req.validado.body;
  const clienteSesion = clienteDeSesion(req);
  const esPortal = Boolean(clienteSesion);
  const esCredito = datos.metodoPago === 'Crédito';
  const plazoDias = esCredito ? datos.plazoDias : 0;
  if (esCredito && !PLAZOS_CREDITO.includes(plazoDias)) {
    throw new HttpError(422, `El plazo debe ser de ${PLAZOS_CREDITO.join(', ')} días.`);
  }

  await enTransaccion(async (db) => {
    const cotizacion = await cotizacionesModel.buscarPorNumero(
      req.params.numero,
      { clienteId: clienteSesion, bloquear: 'c' },
      db,
    );
    if (cotizacion.estado !== 'Pendiente') {
      throw new HttpError(422, `La cotización está "${cotizacion.estado}": ya no se puede aceptar.`);
    }
    const motivos = {
      Solicitud: 'Todavía estamos confirmando los precios: aún no hay cotización formal para aceptar.',
      Aceptada: 'Esta cotización ya fue aceptada.',
      Vencida: 'La cotización venció: pide que te la vuelvan a cotizar con precios actualizados.',
    };
    if (motivos[cotizacion.etapa]) throw new HttpError(422, motivos[cotizacion.etapa]);

    const { interes, total, cuotaMinima } = calcularTotales(cotizacion.subtotal, datos.metodoPago, plazoDias);
    const pares = [
      ['metodo_pago', datos.metodoPago],
      ['plazo_dias', plazoDias],
      ['interes', interes],
      ['total', total],
    ];

    if (esCredito) {
      const cuotaInicial = await validarCredito(db, {
        clienteId: cotizacion.clienteId,
        total,
        cuotaMinima,
        cuota: datos.cuotaInicial,
        esPortal,
      });
      pares.push(
        ['cuota_inicial', cuotaInicial],
        ['cuota_inicial_medio', datos.cuotaInicial.medioPago],
        ['cuota_inicial_comprobante', datos.cuotaInicial.comprobante ?? null],
      );
      await cotizacionesModel.actualizar(db, cotizacion.id, pares);
      await solicitudesCreditoModel.crearParaCotizacion(db, {
        clienteId: cotizacion.clienteId,
        cotizacionId: cotizacion.id,
        monto: total - cuotaInicial,
        plazoDias,
      });
    } else {
      exigirPagoContado(datos.pago, esPortal);
      await cotizacionesModel.actualizar(db, cotizacion.id, pares);
      await pagosModel.crear(db, {
        cotizacionId: cotizacion.id,
        monto: total,
        medioPago: datos.pago.medioPago,
        comprobante: datos.pago.comprobante,
      });
    }

    if (esPortal) {
      const cliente = await avisosPersonal.nombreCliente(db, cotizacion.clienteId);
      await avisosPersonal.crear(
        {
          modulo: 'Pedidos-Cotización',
          titulo: 'Cotización aceptada',
          mensaje: `${cliente} aceptó la cotización ${cotizacion.numero} (${esCredito ? `crédito a ${plazoDias} días` : 'de contado'}): revisa el pago.`,
          enlace: esCredito ? '/admin/solicitudes-credito' : '/admin/pedidos-cotizacion',
          tipo: 'alerta',
        },
        db,
      );
    }
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero), esPortal);
}

// ---------------------------------------------------------------------------
// Actualizar (solo personal)
// ---------------------------------------------------------------------------

/**
 * A crédito, la cotización se aprueba desde su solicitud de crédito; aquí
 * solo se deja pasar ese intento para responder con el aviso de dónde hacerlo.
 */
const esAprobacionDeCredito = (actual, cambios) => actual.metodoPago === 'Crédito' && cambios.estado === 'Aprobada';

/** PATCH /cotizaciones/:numero — estado, entrega y datos de despacho. */
export async function actualizar(req, res) {
  const cambios = req.validado.body;

  await enTransaccion(async (db) => {
    // Se bloquea la fila: dos asesores no la cambian al mismo tiempo
    const actual = await cotizacionesModel.buscarPorNumero(req.params.numero, { bloquear: 'c' }, db);

    // ---- Estados: solo se permiten las transiciones del flujo
    if (cambios.estadoEntrega && cambios.estadoEntrega !== actual.estadoEntrega) {
      validarTransicion('entrega', actual.estadoEntrega, cambios.estadoEntrega);
    }
    const cambiaEstado = cambios.estado && cambios.estado !== actual.estado;
    if (cambiaEstado) validarTransicion('cotizacion', actual.estado, cambios.estado);
    // Cancelar una cotización (sin borrarla) exige decir por qué
    if (cambiaEstado && cambios.estado === 'Rechazada' && !cambios.motivoCancelacion?.trim()) {
      throw new HttpError(422, 'Indica el motivo de la cancelación.');
    }

    const soloRechaza =
      cambios.estado === 'Rechazada' && Object.keys(cambios).every((k) => ['estado', 'motivoCancelacion'].includes(k));
    const cambiaPedido = cambiaEstado || (cambios.estadoEntrega && cambios.estadoEntrega !== actual.estadoEntrega);

    // ---- Una solicitud o una cotización sin aceptar no es todavía un
    // pedido: no avanza ni se despacha (solo se puede rechazar)
    if (actual.etapa !== 'Aceptada' && cambiaPedido && !soloRechaza) {
      throw new HttpError(
        422,
        actual.etapa === 'Solicitud'
          ? 'Primero confirma los precios con el proveedor y emite la cotización formal.'
          : 'El cliente todavía no ha aceptado la cotización formal.',
      );
    }

    // ---- La cotización queda en "Pendiente" hasta que todo su pago esté
    // aprobado: la consignación de contado (o la cuota inicial del crédito)
    // y el de cada servicio de reencauche. Mientras tanto solo se permite
    // rechazarla, salvo con una consignación por revisar.
    if (actual.pagoEstado === 'En revisión' && cambiaPedido) {
      throw new HttpError(422, 'La consignación de esta cotización está pendiente de confirmación: apruébala o recházala primero.');
    }
    const pagoAprobado = !actual.estadoPago || actual.estadoPago === 'Aprobado';
    if (cambiaPedido && !pagoAprobado && !soloRechaza && !esAprobacionDeCredito(actual, cambios)) {
      throw new HttpError(
        422,
        actual.estadoPago === 'Rechazado'
          ? 'Un pago de esta cotización fue rechazado: espera a que el cliente suba uno nuevo.'
          : 'Esta cotización tiene pagos pendientes (consignación, cuota inicial o servicios): sigue en "Pendiente" hasta que estén aprobados.',
      );
    }

    // ---- A crédito: se aprueba aprobando su solicitud de crédito
    const solicitud = await solicitudesCreditoModel.deCotizacion(db, actual.id);
    if (cambiaEstado && cambios.estado === 'Aprobada' && solicitud && solicitud.estado !== 'Aprobada') {
      throw new HttpError(422, `Es a crédito: apruébala desde "Solicitudes de crédito" (${solicitud.numero}).`);
    }

    // ---- Rechazada: su solicitud de crédito pendiente se cierra
    if (cambiaEstado && cambios.estado === 'Rechazada' && solicitud?.estado === 'Pendiente') {
      await solicitudesCreditoModel.resolver(db, solicitud.id, {
        estado: 'Rechazada',
        motivo: cambios.motivoCancelacion || 'La cotización fue rechazada.',
      });
    }

    // ---- Guardar lo demás (proveedor, despacho, motivo, estados)
    await cotizacionesModel.actualizar(db, actual.id, aPares(cambios, cotizacionesModel.COLUMNAS));

    // ---- Aprobada (ya pagó): queda su venta y se le compra al proveedor.
    // Completada: su venta también se completa.
    if (cambiaEstado && cambios.estado === 'Aprobada') {
      await registrarVentaPagada(db, actual.id);
      await generarCompras(db, actual.id);
    }
    if (cambiaEstado && cambios.estado === 'Completada') await completarVenta(db, actual.id);
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero));
}

// ---------------------------------------------------------------------------
// Pago de contado
// ---------------------------------------------------------------------------

/**
 * POST /cotizaciones/:numero/pago — el asesor aprueba o rechaza la
 * consignación más reciente. Rechazada, el cliente recibe el aviso para
 * volver a subir el pago.
 */
export async function revisarPago(req, res) {
  const { estado, motivo } = req.validado.body;
  if (estado === 'Rechazado' && !motivo) throw new HttpError(422, 'Indica por qué se rechaza el pago.');

  await enTransaccion(async (db) => {
    const cotizacion = await cotizacionesModel.buscarPorNumero(req.params.numero, { bloquear: 'c' }, db);
    const pago = await pagosModel.ultimoBloqueado(db, cotizacion.id);
    if (pago?.estado !== 'En revisión') throw new HttpError(422, 'Esta cotización no tiene un pago por revisar.');

    await pagosModel.resolver(db, pago.id, { estado, motivo: estado === 'Rechazado' ? motivo : null });
    // Pagó de contado: la venta queda registrada enseguida
    if (estado === 'Aprobado') await registrarVentaPagada(db, cotizacion.id);
    await notificaciones.crear(
      estado === 'Aprobado'
        ? {
            clienteId: cotizacion.clienteId,
            titulo: `Pago aprobado · ${cotizacion.numero}`,
            mensaje: 'Confirmamos tu consignación. Tu pedido sigue su proceso normal.',
            enlace: '/portal/pedidos',
            tipo: 'exito',
          }
        : {
            clienteId: cotizacion.clienteId,
            titulo: `Pago rechazado · ${cotizacion.numero}`,
            mensaje: `El pago fue rechazado (${motivo}). Por favor vuelve a subir el pago desde "Mis cotizaciones".`,
            enlace: '/portal/pedidos',
            tipo: 'alerta',
          },
      db,
    );
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero));
}

/**
 * POST /portal/cotizaciones/:numero/pago — el cliente vuelve a subir el
 * pago después de un rechazo. Queda otra vez "En revisión".
 */
export async function volverAPagar(req, res) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) throw new HttpError(403, 'Esta acción es para los clientes del portal.');
  const pago = req.validado.body;
  exigirPagoContado(pago, true);

  await enTransaccion(async (db) => {
    const cotizacion = await cotizacionesModel.buscarPorNumero(req.params.numero, { clienteId, bloquear: 'c' }, db);
    const ultimo = await pagosModel.ultimoBloqueado(db, cotizacion.id);
    if (ultimo?.estado !== 'Rechazado') {
      throw new HttpError(422, ultimo ? `Tu pago está "${ultimo.estado}".` : 'Esta cotización no lleva pago de contado.');
    }
    await pagosModel.crear(db, {
      cotizacionId: cotizacion.id,
      monto: cotizacion.total,
      medioPago: pago.medioPago,
      comprobante: pago.comprobante,
    });
    const cliente = await avisosPersonal.nombreCliente(db, clienteId);
    await avisosPersonal.crear(
      {
        modulo: 'Pedidos-Cotización',
        titulo: 'Pago por revisar',
        mensaje: `${cliente} volvió a subir el pago de la cotización ${cotizacion.numero}.`,
        enlace: '/admin/pedidos-cotizacion',
        tipo: 'alerta',
      },
      db,
    );
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero), true);
}

// ---------------------------------------------------------------------------
// Eliminar (solo personal, solo pendientes)
// ---------------------------------------------------------------------------

/** DELETE /cotizaciones/:numero */
export async function eliminar(req, res) {
  await enTransaccion(async (db) => {
    const actual = await cotizacionesModel.buscarPorNumero(req.params.numero, { bloquear: 'c' }, db);
    if (actual.estado !== 'Pendiente') {
      throw new HttpError(422, 'Solo se puede eliminar una cotización pendiente. Las demás se rechazan.');
    }
    // Las solicitudes de reencauche que nacieron con la cotización se van con
    // ella (la de crédito se borra sola: ON DELETE CASCADE)
    const solicitudes = await cotizacionesModel.solicitudesDeLineas(db, actual.id);
    await cotizacionesModel.eliminar(db, actual.id);
    for (const id of solicitudes) await solicitudesModel.eliminarPendiente(db, id);
  });
  enviarSinContenido(res);
}

/**
 * POST /portal/cotizaciones/:numero/cancelar — el cliente cancela su
 * cotización (no se borra: queda Rechazada con su motivo). Solo mientras
 * está Pendiente y todavía no la acepta: después ya hay un pago de por medio
 * y la cancelación la gestiona el asesor.
 */
export async function cancelarDesdePortal(req, res) {
  const clienteId = clienteDeSesion(req);
  if (!clienteId) throw new HttpError(403, 'Esta acción es para los clientes del portal.');
  const { motivo } = req.validado.body;

  await enTransaccion(async (db) => {
    const cotizacion = await cotizacionesModel.buscarPorNumero(req.params.numero, { clienteId, bloquear: 'c' }, db);
    if (cotizacion.estado !== 'Pendiente') {
      throw new HttpError(422, `La cotización está "${cotizacion.estado}": ya no se puede cancelar.`);
    }
    if (cotizacion.etapa === 'Aceptada') {
      throw new HttpError(422, 'Ya aceptaste esta cotización y registraste un pago: comunícate con nosotros para cancelarla.');
    }
    await cotizacionesModel.actualizar(db, cotizacion.id, [
      ['estado', 'Rechazada'],
      ['motivo_cancelacion', `Cancelada por el cliente: ${motivo}`],
    ]);
    const cliente = await avisosPersonal.nombreCliente(db, clienteId);
    await avisosPersonal.crear(
      {
        modulo: 'Pedidos-Cotización',
        titulo: 'Cotización cancelada',
        mensaje: `${cliente} canceló la cotización ${cotizacion.numero}: ${motivo}`,
        enlace: '/admin/pedidos-cotizacion',
        tipo: 'alerta',
      },
      db,
    );
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero), true);
}

/** POST /portal/cotizaciones/:numero/aceptar — solo para el cliente dueño de la cotización. */
export async function aceptarDesdePortal(req, res) {
  if (!clienteDeSesion(req)) throw new HttpError(403, 'Esta acción es para los clientes del portal.');
  await aceptar(req, res);
}
