import { HttpError } from '../errores.js';
import * as comprasModel from '../models/compras.model.js';
import * as cotizacionesModel from '../models/cotizaciones.model.js';
import * as creditosModel from '../models/creditos.model.js';
import * as ventasModel from '../models/ventas.model.js';

/**
 * Documentos que nacen solos de una cotización-pedido. Todas las funciones
 * corren dentro de la transacción de quien las llama: si algo falla, la
 * cotización tampoco cambia.
 *
 *   pago aprobado      → venta "Pendiente" (registrarVentaPagada)
 *   cotización Aprobada → una compra por proveedor (generarCompras)
 *   cotización Completada → su venta pasa a "Completada" (completarVenta)
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
 * La cotización quedó "Aprobada": se le compran las llantas al proveedor.
 * Sale una compra "Pendiente" por cada proveedor, con el costo conocido de
 * cada llanta. Las llantas sin proveedor (ni en la línea ni en la
 * cotización) se dejan para que el asesor las compre a mano.
 */
export async function generarCompras(db, cotizacionId) {
  if (await comprasModel.hayDeCotizacion(db, cotizacionId)) return;

  const porProveedor = new Map();
  for (const linea of await comprasModel.lineasParaComprar(db, cotizacionId)) {
    if (!linea.proveedorId) continue;
    if (!porProveedor.has(linea.proveedorId)) porProveedor.set(linea.proveedorId, []);
    porProveedor.get(linea.proveedorId).push(linea);
  }

  for (const [proveedorId, lineas] of porProveedor) {
    const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
    const compra = await comprasModel.crear(db, { proveedorId, cotizacionId, total });
    for (const linea of lineas) await comprasModel.crearLinea(db, compra.id, { ...linea, origen: 'Cotización' });
  }
}
