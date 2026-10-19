import { HttpError } from '../errores.js';
import * as productosModel from '../models/productos.model.js';

/**
 * Movimientos de inventario (stock de las llantas).
 *
 *   · Una cotización-pedido descuenta el stock al crearse.
 *   · Si se rechaza, se elimina o su venta se anula, las unidades vuelven.
 *   · Una compra suma su mercancía cuando queda Recibida y Entregada.
 *
 * Solo las líneas de producto mueven el stock; los servicios (reencauche)
 * no son inventario. Todo corre dentro de la transacción del documento:
 * si algo falla, el stock tampoco cambia.
 */

const deProducto = (lineas) => lineas.filter((l) => l.tipo !== 'servicio' && l.productoId);

/** Descuenta el stock de cada producto pedido; 422 si no alcanza. */
export async function descontarLineas(db, lineas) {
  for (const linea of deProducto(lineas)) {
    if (!(await productosModel.descontarStock(db, linea.productoId, linea.cantidad))) {
      const producto = await productosModel.paraCotizar(db, linea.productoId);
      throw new HttpError(
        422,
        `No hay suficientes unidades de "${producto?.nombre ?? 'un producto'}": quedan ${producto?.stock ?? 0}.`,
      );
    }
  }
}

/** Devuelve al stock las unidades de las líneas de producto. */
export async function devolverLineas(db, lineas) {
  for (const linea of deProducto(lineas)) await productosModel.sumarStock(db, linea.productoId, linea.cantidad);
}

/** Suma la mercancía de una compra y guarda el último precio de compra. */
export async function ingresarCompra(db, lineas) {
  for (const linea of lineas) {
    await productosModel.sumarStock(db, linea.productoId, linea.cantidad);
    await productosModel.actualizarPrecioCompra(db, linea.productoId, linea.precioUnitario);
  }
}
