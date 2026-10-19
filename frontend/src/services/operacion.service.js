// =========================================================================
// Servicios de la operación: cotizaciones-pedido, ventas y compras.
// =========================================================================

import {
  compraDesdeApi,
  cotizacionDesdeApi,
  idPorNombre,
  imagenCambiada,
  ventaDesdeApi,
} from './adaptadores';
import { api, conClave } from './http';
import { crearServicio } from './recurso';
import { parseCOP, vacioANull } from '../utils/formato';

/** Operaciones comunes de los documentos: cambiar estado y cambios sueltos. */
function conCambios(servicio) {
  return {
    ...servicio,
    /** Cambia el estado del documento (la API valida el flujo). */
    cambiarEstado: (fila, estado) => servicio.enviar(fila, { estado }),
    /** Cambios desde una celda de la tabla (p. ej. el estado de entrega). */
    actualizar: (fila, cambios) => servicio.enviar(fila, cambios),
  };
}

// ---- Cotizaciones-pedido ---------------------------------------------------------

/** Edición desde la tabla del asesor: proveedor, despacho, estados y motivo. */
function cotizacionHaciaApi(v, fila, { proveedores }) {
  return {
    proveedorId: idPorNombre(proveedores, v.proveedor, 'nombreRazonSocial'),
    direccionEntrega: v.direccionEntrega,
    motivoCancelacion: vacioANull(v.motivoCancelacion),
    estado: v.estado,
    estadoEntrega: v.estadoEntrega,
  };
}

/** Una línea de servicio del formulario → línea de la API. */
const lineaServicio = (l) => ({
  tipo: 'servicio',
  servicioId: l.servicioId,
  cantidad: l.cantidad,
  medidas: l.medidas || null,
  descripcion: l.descripcion,
  foto: l.foto,
  estadoEvidencia: l.estadoEvidencia,
});

const cotizacionesBase = conCambios(
  crearServicio({
    ruta: '/cotizaciones',
    desdeApi: cotizacionDesdeApi,
    haciaApi: cotizacionHaciaApi,
    metodoEditar: 'PATCH',
  }),
);

export const cotizacionesService = {
  ...cotizacionesBase,

  /**
   * Nueva cotización armada por un asesor (formulario "Nueva cotización").
   * Los precios no se envían: la API los toma del catálogo.
   *
   *   datos:    { cliente, proveedor, fecha, metodoPago, plazo, direccion, lineas, cuotaInicial }
   *   contexto: { clientes, proveedores } para convertir nombres en ids
   */
  crearDesdePanel(datos, { clientes, proveedores }) {
    const esCredito = datos.metodoPago === 'Crédito';
    return api('/cotizaciones', {
      metodo: 'POST',
      cuerpo: {
        clienteId: idPorNombre(clientes, datos.cliente, 'nombreCompleto'),
        proveedorId: idPorNombre(proveedores, datos.proveedor, 'nombreRazonSocial'),
        fecha: datos.fecha,
        metodoPago: datos.metodoPago,
        plazoDias: esCredito ? datos.plazo : 0,
        direccionEntrega: datos.direccion,
        lineas: datos.lineas.map((l) =>
          l.tipo === 'producto'
            ? { tipo: 'producto', productoId: l.productoId, cantidad: l.cantidad }
            : lineaServicio({ ...l, medidas: l.medida, descripcion: l.detalle }),
        ),
        ...(esCredito ? { cuotaInicial: { monto: datos.cuotaInicial } } : {}),
        // De contado: cómo se paga y la consignación
        ...(!esCredito && datos.pago?.medioPago
          ? { pago: { medioPago: datos.pago.medioPago, comprobante: datos.pago.comprobante || undefined } }
          : {}),
      },
    });
  },

  /** El asesor aprueba o rechaza la consignación del pago de contado. */
  revisarPago: (fila, estado, motivo) =>
    cotizacionesBase.enviar(fila, { estado, motivo: motivo || undefined }, { metodo: 'POST', sufijo: '/pago' }),

  /** El cliente vuelve a subir el pago de contado que fue rechazado. */
  volverAPagar: (numero, pago) =>
    api(`/portal/cotizaciones/${encodeURIComponent(numero)}/pago`, {
      metodo: 'POST',
      cuerpo: { medioPago: pago.medioPago, comprobante: pago.comprobante || undefined },
    }),

  /**
   * Cotización que envía un cliente desde el portal (su "carrito").
   *
   *   datos: { metodoPago, plazo, direccion, productos, servicios, abonoInicial, pago }
   *   abonoInicial: pago de la cuota inicial (solo a crédito)
   *   pago: { medioPago, comprobante } (solo de contado)
   */
  crearDesdePortal({ metodoPago, plazo, direccion, productos, servicios, abonoInicial, pago, claveIdempotencia }) {
    const esCredito = metodoPago === 'Crédito';
    return api('/cotizaciones', {
      // Si el envío se repite, la API devuelve la misma cotización
      cabecerasExtra: conClave(claveIdempotencia),
      metodo: 'POST',
      cuerpo: {
        metodoPago,
        plazoDias: esCredito ? plazo : 0,
        direccionEntrega: direccion,
        lineas: [
          ...productos.map((p) => ({ tipo: 'producto', productoId: p.id, cantidad: p.cantidad })),
          ...servicios.map((s) => lineaServicio(s)),
        ],
        ...(esCredito && abonoInicial
          ? {
              cuotaInicial: {
                monto: parseCOP(abonoInicial.monto),
                medioPago: abonoInicial.metodoPago,
                comprobante: abonoInicial.comprobante || undefined,
              },
            }
          : {}),
        // De contado (con productos): cómo se paga y la consignación
        ...(!esCredito && pago?.medioPago
          ? { pago: { medioPago: pago.medioPago, comprobante: pago.comprobante || undefined } }
          : {}),
      },
    });
  },
};

// ---- Ventas ----------------------------------------------------------------------

/** Al crear se envía todo; al editar, solo lo que una venta deja cambiar. */
function ventaHaciaApi(v, fila, { clientes, proveedores, terceros }) {
  const proveedorId = idPorNombre(proveedores, v.proveedor, 'nombreRazonSocial');
  const terceroId = idPorNombre(terceros, v.tercero, 'nombreRazonSocial');
  if (fila) {
    return {
      proveedorId,
      terceroId,
      estado: v.estado,
      estadoEntrega: v.estadoEntrega,
      comprobante: imagenCambiada(v.comprobantePago, fila.comprobantePago),
    };
  }
  return {
    clienteId: idPorNombre(clientes, v.cliente, 'nombreCompleto'),
    proveedorId,
    terceroId,
    fecha: v.fecha,
    metodoPago: v.metodoPago,
    total: parseCOP(v.total),
    interes: parseCOP(v.interes),
    cuotaInicial: parseCOP(v.cuotaInicial),
    comprobante: v.comprobantePago || null,
  };
}

export const ventasService = conCambios(
  crearServicio({ ruta: '/ventas', desdeApi: ventaDesdeApi, haciaApi: ventaHaciaApi, metodoEditar: 'PATCH' }),
);

// ---- Compras -----------------------------------------------------------------------

/**
 * Al editar solo viajan el estado y la entrega. Al crear, el formulario
 * "Nueva compra" entrega { proveedor, cotizacion, lineas }.
 */
function compraHaciaApi(v, fila, contexto) {
  if (fila) return { estado: v.estado, estadoEntrega: v.estadoEntrega };
  return {
    proveedorId: idPorNombre(contexto.proveedores, v.proveedor, 'nombreRazonSocial'),
    cotizacion: v.cotizacion || null,
    lineas: v.lineas.map((l) => ({
      productoId: l.id,
      cantidad: l.cantidad,
      precioUnitario: l.precioCompra,
      // Distingue lo que pedía la cotización de lo que sumó el asesor
      origen: l.deCotizacion ? 'Cotización' : 'Adicional',
    })),
  };
}

export const comprasService = {
  ...conCambios(
    crearServicio({ ruta: '/compras', desdeApi: compraDesdeApi, haciaApi: compraHaciaApi, metodoEditar: 'PATCH' }),
  ),

  /**
   * Productos de una cotización convertidos en líneas de compra. El precio
   * propuesto es el último de compra conocido; el asesor lo ajusta.
   * Los servicios no se compran: los ejecuta un tercero.
   */
  async lineasDeCotizacion(numeroCotizacion, productos) {
    const cotizacion = await cotizacionesService.obtener(numeroCotizacion);
    return cotizacion.detalle
      .filter((l) => l.tipo === 'producto')
      .map((l) => {
        const ficha = productos.find((p) => p.id === l.productoId);
        return {
          id: l.productoId,
          nombre: l.nombre,
          medidas: l.medida,
          precioCompra: ficha?.precioCompra ?? 0,
          cantidad: l.cantidad,
          deCotizacion: true,
        };
      });
  },
};
