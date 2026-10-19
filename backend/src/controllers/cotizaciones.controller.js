import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import { claveIdempotencia } from '../middleware/idempotencia.js';
import * as clientesModel from '../models/clientes.model.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import { aPares } from '../models/listado.model.js';
import * as productosModel from '../models/productos.model.js';
import * as creditosModel from '../models/creditos.model.js';
import * as notificaciones from '../models/notificaciones.model.js';
import * as avisosPersonal from '../models/notificacionesPersonal.model.js';
import * as pagosModel from '../models/pagosCotizacion.model.js';
import * as serviciosModel from '../models/servicios.model.js';
import * as solicitudesCreditoModel from '../models/solicitudesCredito.model.js';
import * as solicitudesModel from '../models/solicitudesServicio.model.js';
import * as ventasModel from '../models/ventas.model.js';
import {
  calcularTotales,
  CUPO_CARTERA,
  pesos,
  PLAZOS_CREDITO,
  SERVICIO_POR_DEFECTO,
  validarTransicion,
} from '../reglas.js';
import { enviarDocumento, enviarDocumentos } from '../views/documentos.view.js';
import { enviarSinContenido } from '../views/respuesta.view.js';
import { descontarLineas, devolverLineas } from './inventario.js';

/**
 * Controlador de cotizaciones-pedido.
 *
 * - El cliente del portal crea cotizaciones para sí mismo; el asesor, para
 *   cualquier cliente.
 * - Los precios se toman del catálogo, nunca del navegador.
 * - El total es precio del catálogo × cantidad (más el interés si es a
 *   crédito); nadie lo escribe a mano.
 * - Al crearse descuenta el stock de los productos; si se rechaza o se
 *   elimina, las unidades vuelven.
 * - Si es a crédito, crea su solicitud de crédito: el asesor la aprueba o
 *   no en "Solicitudes de crédito" (ver solicitudesCredito.controller.js).
 * - De contado (con valor), lleva la consignación del pago: queda "En
 *   revisión" y la cotización no cambia de estado hasta que el asesor la
 *   apruebe. Si la rechaza, el cliente sube otra (quedan como historial).
 * - Solo el personal cambia estados o elimina.
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

/** Pago de contado: con qué medio y, salvo en efectivo, con su consignación. */
function exigirPagoContado(pago) {
  if (!pago?.medioPago) throw new HttpError(422, 'Indica cómo vas a pagar (efectivo, transferencia u otro).');
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

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

/**
 * Pone precio y descripción a cada línea tomándolos del catálogo.
 * Lanza 422 si un producto o servicio no existe o no está disponible.
 */
async function preciosDelCatalogo(db, lineasPedidas) {
  const lineas = [];
  for (const linea of lineasPedidas) {
    if (linea.tipo === 'producto') {
      const producto = await productosModel.paraCotizar(db, linea.productoId);
      if (!producto?.activo) throw new HttpError(422, 'Uno de los productos no existe o ya no está a la venta.');
      lineas.push({
        ...linea,
        descripcion: producto.nombre,
        medida: producto.medidas,
        precioUnitario: producto.precio_venta,
      });
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

/**
 * Reglas del crédito al crear una cotización. Devuelve la cuota inicial
 * que se guarda (la pagada, o la mínima si el asesor no indicó otra).
 */
async function validarCredito(db, { clienteId, total, cuotaMinima, pago, esPortal }) {
  const abierto = await clientesModel.creditoAbierto(db, clienteId);
  if (abierto) {
    throw new HttpError(422, `El cliente ya tiene el crédito ${abierto} abierto: solo se permite uno a la vez.`);
  }
  const pendiente = await solicitudesCreditoModel.pendienteDeCliente(db, clienteId);
  if (pendiente) {
    throw new HttpError(422, `El cliente ya tiene la solicitud de crédito ${pendiente} en revisión.`);
  }
  if (total > CUPO_CARTERA) {
    throw new HttpError(422, `El total (${pesos(total)}) supera el cupo de crédito de ${pesos(CUPO_CARTERA)}.`);
  }
  // El cliente debe pagar la cuota inicial antes de enviar la cotización
  if (esPortal && !pago) throw new HttpError(422, 'Registra el abono de la cuota inicial para enviar la cotización.');
  const cuotaInicial = pago?.monto ?? cuotaMinima;
  if (cuotaInicial < cuotaMinima) {
    throw new HttpError(422, `La cuota inicial debe ser de al menos ${pesos(cuotaMinima)} (50 % del total).`);
  }
  if (cuotaInicial >= total) throw new HttpError(422, 'Si se paga todo de una vez, elige pago de contado.');
  if (esPortal && !pago.medioPago) throw new HttpError(422, 'Indica el medio de pago de la cuota inicial.');
  // En efectivo se paga en el local; con cualquier otro medio hay pantallazo
  if (pago?.medioPago && pago.medioPago !== 'Efectivo' && !pago.comprobante) {
    throw new HttpError(422, 'Adjunta el comprobante del pago de la cuota inicial.');
  }
  return cuotaInicial;
}

/** POST /cotizaciones */
export async function crear(req, res) {
  const datos = req.validado.body;
  const esPortal = Boolean(clienteDeSesion(req));
  const clienteId = esPortal ? clienteDeSesion(req) : datos.clienteId;
  if (!clienteId) throw new HttpError(422, 'Selecciona el cliente de la cotización.');

  const esCredito = datos.metodoPago === 'Crédito';
  const plazoDias = esCredito ? datos.plazoDias : 0;
  if (esCredito && !PLAZOS_CREDITO.includes(plazoDias)) {
    throw new HttpError(422, `El plazo debe ser de ${PLAZOS_CREDITO.join(', ')} días.`);
  }

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

    // 1. Precios de cada línea, tomados del catálogo
    const lineas = await preciosDelCatalogo(db, datos.lineas);

    // 2. Totales con las reglas del negocio
    const subtotal = lineas.reduce((suma, l) => suma + l.precioUnitario * l.cantidad, 0);
    const { interes, total, cuotaMinima } = calcularTotales(subtotal, datos.metodoPago, plazoDias);

    // 3. Reglas del crédito; de contado con valor, el pago
    const cuotaInicial = esCredito
      ? await validarCredito(db, { clienteId, total, cuotaMinima, pago: datos.cuotaInicial, esPortal })
      : 0;
    const pagaContado = !esCredito && total > 0;
    if (pagaContado) exigirPagoContado(datos.pago);

    // 4. Cabecera. El valor que arma el cliente lo confirma después un asesor
    const cotizacion = await cotizacionesModel.crear(db, {
      clienteId,
      proveedorId: esPortal ? null : datos.proveedorId,
      fecha: esPortal ? null : datos.fecha,
      metodoPago: datos.metodoPago,
      plazoDias,
      subtotal,
      interes,
      total,
      cuotaInicial,
      cuotaInicialMedio: datos.cuotaInicial?.medioPago,
      cuotaInicialComprobante: datos.cuotaInicial?.comprobante,
      // El total lo calculó el servidor con los precios del catálogo
      confirmado: true,
      direccionEntrega: datos.direccionEntrega,
      claveIdempotencia: clave,
    });

    // 5. Líneas. Cada servicio abre su solicitud de reencauche
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
    // 6. Las llantas pedidas salen del inventario (422 si no alcanzan)
    await descontarLineas(db, lineas);

    // 7. De contado: la consignación queda en revisión del asesor
    if (pagaContado) {
      await pagosModel.crear(db, {
        cotizacionId: cotizacion.id,
        monto: total,
        medioPago: datos.pago.medioPago,
        comprobante: datos.pago.comprobante,
      });
    }

    // 8. A crédito: queda pendiente la solicitud por lo que se financia
    if (esCredito) {
      await solicitudesCreditoModel.crearParaCotizacion(db, {
        clienteId,
        cotizacionId: cotizacion.id,
        monto: total - cuotaInicial,
        plazoDias,
      });
    }

    // 9. Si la hizo el cliente desde el portal, se avisa al personal
    if (esPortal) {
      const cliente = await avisosPersonal.nombreCliente(db, clienteId);
      await avisosPersonal.crear(
        {
          modulo: 'Pedidos-Cotización',
          titulo: 'Nueva cotización',
          mensaje: `${cliente} envió la cotización ${cotizacion.numero} (${esCredito ? 'a crédito' : 'de contado'}).`,
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
// Actualizar (solo personal)
// ---------------------------------------------------------------------------

/**
 * Crea la venta de una cotización completada, copiando sus líneas. Corre
 * dentro de la misma transacción: si algo falla, la cotización tampoco
 * cambia de estado.
 */
async function generarVenta(db, cotizacionId) {
  const cotizacion = await cotizacionesModel.fila(db, cotizacionId);
  // Solo servicios (que se cobran aparte): no hay venta de productos que registrar
  if (cotizacion.total <= 0) return;
  if (await cotizacionesModel.tieneLineasSinPrecio(db, cotizacionId)) {
    throw new HttpError(422, 'Hay líneas sin precio: no se puede generar la venta.');
  }
  const ventaId = await ventasModel.crearDesdeCotizacion(db, cotizacion);
  // Si la cotización se financió, su crédito queda ligado a la venta
  await creditosModel.ligarVenta(db, cotizacionId, ventaId);
}

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

    // ---- La cotización queda en "Pendiente" hasta que todo su pago esté
    // aprobado: la consignación de contado (o la cuota inicial del crédito)
    // y el de cada servicio de reencauche. Mientras tanto solo se permite
    // rechazarla, salvo con una consignación por revisar.
    if (actual.pagoEstado === 'En revisión') {
      throw new HttpError(422, 'La consignación de esta cotización está pendiente de confirmación: apruébala o recházala primero.');
    }
    const pagoAprobado = !actual.estadoPago || actual.estadoPago === 'Aprobado';
    const soloRechaza = cambios.estado === 'Rechazada' && Object.keys(cambios).every((k) => ['estado', 'motivoCancelacion'].includes(k));
    if (!pagoAprobado && !soloRechaza && !esAprobacionDeCredito(actual, cambios)) {
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

    // ---- Rechazada: las llantas vuelven al inventario y su solicitud se cierra
    if (cambiaEstado && cambios.estado === 'Rechazada') {
      await devolverLineas(db, await cotizacionesModel.lineas(actual.id, db));
      if (solicitud?.estado === 'Pendiente') {
        await solicitudesCreditoModel.resolver(db, solicitud.id, {
          estado: 'Rechazada',
          motivo: cambios.motivoCancelacion || 'La cotización fue rechazada.',
        });
      }
    }

    // ---- Guardar lo demás (proveedor, despacho, motivo, estados)
    await cotizacionesModel.actualizar(db, actual.id, aPares(cambios, cotizacionesModel.COLUMNAS));

    // ---- Al completarla se genera la venta
    if (cambiaEstado && cambios.estado === 'Completada') await generarVenta(db, actual.id);
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
  exigirPagoContado(pago);

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
    // Las llantas vuelven al inventario
    await devolverLineas(db, await cotizacionesModel.lineas(actual.id, db));
    // Las solicitudes de reencauche que nacieron con la cotización se van con
    // ella (la de crédito se borra sola: ON DELETE CASCADE)
    const solicitudes = await cotizacionesModel.solicitudesDeLineas(db, actual.id);
    await cotizacionesModel.eliminar(db, actual.id);
    for (const id of solicitudes) await solicitudesModel.eliminarPendiente(db, id);
  });
  enviarSinContenido(res);
}
