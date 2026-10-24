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
import { api, conClave, descargarArchivo } from './http';
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
  // Hasta 3 fotos de la llanta
  fotos: l.fotos?.length ? l.fotos : undefined,
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
   * Solicitud de cotización armada por un asesor ("Nueva cotización"). Solo
   * cliente, llantas, cantidades y servicios: la fecha la pone el servidor,
   * los precios se confirman al emitir y el método de pago se elige al
   * aceptar.
   *
   *   datos: { clienteId, direccion, lineas }   (direccion = lugar de despacho)
   */
  crearDesdePanel(datos) {
    return api('/cotizaciones', {
      metodo: 'POST',
      cuerpo: {
        clienteId: datos.clienteId,
        direccionEntrega: datos.direccion,
        lineas: datos.lineas.map((l) =>
          l.tipo === 'producto'
            ? { tipo: 'producto', productoId: l.productoId, cantidad: l.cantidad }
            : lineaServicio({ ...l, medidas: l.medida, descripcion: l.detalle }),
        ),
      },
    });
  },

  /**
   * El asesor verifica cada llanta con el proveedor, fija el precio de
   * venta y emite la cotización formal (vigencia de 8 días).
   *   lineas: [{ id, proveedorId, precioUnitario }]
   */
  emitir: (numero, lineas) =>
    api(`/cotizaciones/${encodeURIComponent(numero)}/emitir`, { metodo: 'POST', cuerpo: { lineas } }),

  /**
   * Acepta la cotización formal: contado (con su pago) o crédito (plazo y
   * cuota inicial). El cliente lo hace desde el portal; el asesor, por él en
   * el local.
   *   datos: { metodoPago, plazoDias, pago: { medioPago, comprobante } }
   *   (a crédito no se paga nada al aceptar: la cuota se paga ya aprobado el crédito)
   */
  aceptar(numero, datos, { desdePortal = false } = {}) {
    const esCredito = datos.metodoPago === 'Crédito';
    const conComprobante = (p) => ({ medioPago: p.medioPago, comprobante: p.comprobante || undefined });
    return api(`${desdePortal ? '/portal' : ''}/cotizaciones/${encodeURIComponent(numero)}/aceptar`, {
      metodo: 'POST',
      cuerpo: {
        metodoPago: datos.metodoPago,
        ...(esCredito ? { plazoDias: datos.plazoDias } : { pago: conComprobante(datos.pago) }),
      },
    });
  },

  /** Descarga la cotización formal en PDF. */
  descargarPdf: (numero) => descargarArchivo(`/cotizaciones/${encodeURIComponent(numero)}/pdf`, `Cotizacion-${numero}.pdf`),

  /** El asesor aprueba o rechaza la consignación del pago de contado. */
  revisarPago: (fila, estado, motivo) =>
    cotizacionesBase.enviar(fila, { estado, motivo: motivo || undefined }, { metodo: 'POST', sufijo: '/pago' }),

  /** El cliente vuelve a subir el pago de contado que fue rechazado. */
  volverAPagar: (numero, pago) =>
    api(`/portal/cotizaciones/${encodeURIComponent(numero)}/pago`, {
      metodo: 'POST',
      cuerpo: { medioPago: pago.medioPago, comprobante: pago.comprobante || undefined },
    }),

  /** Cuota inicial de un crédito ya aprobado (cliente desde el portal o asesor en el local). */
  pagarCuota: (numero, pago, { desdePortal = true } = {}) =>
    api(`${desdePortal ? '/portal' : ''}/cotizaciones/${encodeURIComponent(numero)}/cuota`, {
      metodo: 'POST',
      cuerpo: { medioPago: pago.medioPago, comprobante: pago.comprobante || undefined },
    }),

  /** El cliente cancela su cotización pendiente (sin aceptar) con su motivo. */
  cancelarDesdePortal: (numero, motivo) =>
    api(`/portal/cotizaciones/${encodeURIComponent(numero)}/cancelar`, { metodo: 'POST', cuerpo: { motivo } }),

  /**
   * Solicitud de cotización que envía un cliente desde el portal (su
   * "carro"): llantas, cantidades y servicios, sin precios ni pago.
   *   datos: { direccion, productos, servicios, claveIdempotencia }
   */
  crearDesdePortal({ direccion, productos, servicios, claveIdempotencia }) {
    return api('/cotizaciones', {
      // Si el envío se repite, la API devuelve la misma solicitud
      cabecerasExtra: conClave(claveIdempotencia),
      metodo: 'POST',
      cuerpo: {
        direccionEntrega: direccion,
        lineas: [
          ...productos.map((p) => ({ tipo: 'producto', productoId: p.id, cantidad: p.cantidad })),
          ...servicios.map((s) => lineaServicio(s)),
        ],
      },
    });
  },
};

// ---- Ventas ----------------------------------------------------------------------

/**
 * Al crear se envía todo; al editar, solo lo que una venta deja cambiar.
 * Cliente, proveedor y tercero llegan como ids desde los buscadores.
 */
function ventaHaciaApi(v, fila, { proveedores = [], terceros = [] } = {}) {
  const proveedorId = v.proveedorId || idPorNombre(proveedores, v.proveedor, 'nombreRazonSocial');
  const terceroId = v.terceroId || idPorNombre(terceros, v.tercero, 'nombreRazonSocial');
  if (fila) {
    return {
      proveedorId,
      terceroId,
      comprobante: imagenCambiada(v.comprobantePago, fila.comprobantePago),
    };
  }
  return {
    clienteId: v.clienteId || null,
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

export const ventasService = {
  ...conCambios(
    crearServicio({ ruta: '/ventas', desdeApi: ventaDesdeApi, haciaApi: ventaHaciaApi, metodoEditar: 'PATCH' }),
  ),

  /** Descarga el comprobante de la venta en PDF (el cliente, desde su portal). */
  descargarPdf: (numero, { desdePortal = false } = {}) =>
    descargarArchivo(
      `${desdePortal ? '/portal' : ''}/ventas/${encodeURIComponent(numero)}/pdf`,
      `Comprobante-${numero}.pdf`,
    ),
};

// ---- Compras -----------------------------------------------------------------------

/**
 * Al editar solo viajan el estado y la entrega. Al crear, el formulario
 * "Nueva compra" entrega { proveedor, cotizacion, lineas }.
 */
function compraHaciaApi(v, fila, contexto) {
  if (fila) return { estado: v.estado, estadoEntrega: v.estadoEntrega };
  return {
    proveedorId: v.proveedorId || idPorNombre(contexto.proveedores ?? [], v.proveedor, 'nombreRazonSocial'),
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
   * propuesto es el último costo de compra conocido (el asesor lo ajusta) y
   * cada línea dice si el precio se verificó con el proveedor al emitir la
   * cotización. Los servicios no se compran: los ejecuta un tercero.
   */
  async lineasDeCotizacion(numeroCotizacion) {
    const cotizacion = await cotizacionesService.obtener(numeroCotizacion);
    return cotizacion.detalle
      .filter((l) => l.tipo === 'producto')
      .map((l) => ({
        id: l.productoId,
        nombre: l.nombre,
        medidas: l.medida,
        precioCompra: l.costoProveedor ?? l.ultimoCosto ?? 0,
        costoConfirmadoEn: l.costoConfirmadoEn,
        proveedorConfirmado: l.costoConfirmadoEn ? l.proveedorLinea : '',
        cantidad: l.cantidad,
        deCotizacion: true,
      }));
  },
};
