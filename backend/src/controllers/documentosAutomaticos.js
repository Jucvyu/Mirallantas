import { HttpError } from '../errores.js';
import * as abonosModel from '../models/abonos.model.js';
import * as comprasModel from '../models/compras.model.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import * as creditosModel from '../models/creditos.model.js';
import * as solicitudesCreditoModel from '../models/solicitudesCredito.model.js';
import * as ventasModel from '../models/ventas.model.js';
import * as avisosPersonal from '../models/notificacionesPersonal.model.js';

/**
 * Documentos que nacen solos de una cotización-pedido. Todas las funciones
 * corren dentro de la transacción de quien las llama: si algo falla, la
 * cotización tampoco cambia.
 *
 *   pago aprobado      → venta "Pendiente" (registrarVentaPagada)
 *   todo el pago aprobado → la cotización pasa a "Aprobada" (aprobarSiPagada)
 *   cotización Aprobada → la compra de sus llantas (generarCompras)
 *   cotización Completada → su venta pasa a "Completada" (completarVenta)
 *   cualquier cambio      → la venta copia estado y entrega (sincronizarVenta)
 *
 * Cada una revisa si el documento ya existe, así que llamarla dos veces no
 * duplica nada.
 */

/**
 * El cliente pagó (consignación de contado aprobada, o crédito aprobado con
 * su cuota inicial): queda registrada la venta, todavía "Pendiente" hasta
 * que el pedido se complete. Si alguna línea aún no tiene precio (un
 * reencauche que se cobra aparte), la venta se genera al completarla.
 */
export async function registrarVentaPagada(db, cotizacionId) {
  const cotizacion = await cotizacionesModel.fila(db, cotizacionId);
  // Solo servicios (que se cobran aparte): no hay venta de productos que registrar
  if (cotizacion.total <= 0) return;
  if (await ventasModel.deCotizacion(db, cotizacionId)) return;
  if (await cotizacionesModel.tieneLineasSinPrecio(db, cotizacionId)) return;
  const ventaId = await ventasModel.crearDesdeCotizacion(db, cotizacion, 'Pendiente');
  // Si la cotización se financió, su crédito queda ligado a la venta
  await creditosModel.ligarVenta(db, cotizacionId, ventaId);
}

/** Estado de la venta según el de su cotización. */
const ESTADO_VENTA = { Completada: 'Completada', Rechazada: 'Anulada' };

/**
 * La venta de una cotización no se maneja a mano: copia el estado (Pendiente,
 * Completada o Anulada si la cotización se rechazó) y la entrega de su
 * cotización. Se llama después de cada cambio de la cotización.
 */
export async function sincronizarVenta(db, cotizacionId) {
  const venta = await ventasModel.deCotizacion(db, cotizacionId);
  if (!venta) return;
  const cotizacion = await cotizacionesModel.fila(db, cotizacionId);
  await ventasModel.actualizar(db, venta.id, [
    ['estado', ESTADO_VENTA[cotizacion.estado] ?? 'Pendiente'],
    ['estado_entrega', cotizacion.estado_entrega],
  ]);
}

/**
 * Con todo su pago aprobado (la consignación de contado o la cuota inicial
 * del crédito, y los reencauches que se cobran aparte), la cotización pasa
 * sola de "Pendiente" a "Aprobada": queda su venta y se le compra al
 * proveedor. Devuelve true si la aprobó.
 */
export async function aprobarSiPagada(db, cotizacionId) {
  const { estado, metodoPago, estadoPago } = await cotizacionesModel.estadoDePago(db, cotizacionId);
  if (estado !== 'Pendiente' || !metodoPago || estadoPago !== 'Aprobado') return false;
  await cotizacionesModel.actualizar(db, cotizacionId, [['estado', 'Aprobada']]);
  await registrarVentaPagada(db, cotizacionId);
  await generarCompras(db, cotizacionId);
  await sincronizarVenta(db, cotizacionId);
  return true;
}

/**
 * A crédito: el asesor confirmó el pago de la cuota inicial. Queda como abono
 * confirmado del crédito (baja su saldo) y se guarda cómo se pagó.
 */
export async function abonarCuotaInicial(db, cotizacionId, pago) {
  const numero = await creditosModel.creditoDeCotizacion(db, cotizacionId);
  if (!numero) return;
  const credito = await creditosModel.buscarPorNumero(numero, {}, db);
  await abonosModel.crear(db, {
    creditoId: credito.id,
    monto: pago.monto,
    medioPago: pago.medioPago,
    comprobante: pago.comprobante,
    estado: 'Confirmado',
  });
  await creditosModel.descontarSaldo(db, credito.id, pago.monto);
  // Con la cuota pagada el crédito empieza y su solicitud queda "Aprobada"
  await creditosModel.iniciar(db, credito.id);
  await solicitudesCreditoModel.cuotaPagada(db, cotizacionId);
  await cotizacionesModel.actualizar(db, cotizacionId, [
    ['cuota_inicial_medio', pago.medioPago],
    ['cuota_inicial_comprobante', pago.comprobante ?? null],
  ]);
}

/** La cotización se completó: su venta queda "Completada" (y se crea si faltaba). */
export async function completarVenta(db, cotizacionId) {
  const cotizacion = await cotizacionesModel.fila(db, cotizacionId);
  if (cotizacion.total <= 0) return;
  const venta = await ventasModel.deCotizacion(db, cotizacionId);
  if (venta) {
    if (venta.estado === 'Pendiente') await ventasModel.actualizar(db, venta.id, [['estado', 'Completada']]);
    return;
  }
  if (await cotizacionesModel.tieneLineasSinPrecio(db, cotizacionId)) {
    throw new HttpError(422, 'Hay líneas sin precio: no se puede generar la venta.');
  }
  const ventaId = await ventasModel.crearDesdeCotizacion(db, cotizacion, 'Completada');
  await creditosModel.ligarVenta(db, cotizacionId, ventaId);
}

/**
 * La cotización quedó "Aprobada" (el cliente ya pagó): sale sola la compra
 * de sus llantas, "Pendiente", con el costo conocido de cada una (el que se
 * verificó con el proveedor o el último de compra). Una sola compra por
 * cotización; si solo tiene reencauches, no hay nada que comprar.
 */
export async function generarCompras(db, cotizacionId) {
  if (await comprasModel.hayDeCotizacion(db, cotizacionId)) return;

  // Solo llantas: los reencauches los hace un tercero y no se compran
  const lineas = await comprasModel.lineasParaComprar(db, cotizacionId);
  if (lineas.length === 0) return;

  const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
  const compra = await comprasModel.crear(db, { proveedorId: comprasModel.proveedorComun(lineas), cotizacionId, total });
  for (const linea of lineas) await comprasModel.crearLinea(db, compra.id, { ...linea, origen: 'Cotización' });
  await avisosPersonal.crear(
    {
      modulo: 'Compras',
      titulo: 'Nueva compra por gestionar',
      mensaje: `Se generó la compra ${compra.numero} con las llantas de una cotización aprobada.`,
      enlace: '/admin/compras',
    },
    db,
  );
}
