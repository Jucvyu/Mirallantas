// =========================================================================
// Adaptadores entre la API y las pantallas.
//
// La API y las pantallas hablan casi igual, pero no del todo:
//
//   API                         Pantalla
//   activo: true             →  estado: 'Activo'
//   total: 1968000           →  total: '$ 1.968.000'
//   numero: 'PED-2024-001'   →  id: 'PED-2024-001'  (lo que se muestra)
//   categoriaId: 3           ←  categoria: 'Turismo' (lo que se elige)
//
// Las funciones "desdeApi" convierten lo que llega del servidor al
// formato de la pantalla, y las "haciaApi" convierten lo que el usuario
// llenó en un formulario al cuerpo que espera el servidor. Tenerlas aquí
// evita repetir estas conversiones en cada página.
// =========================================================================

import { formatCOP, formatCOPoGuion, parseCOP, vacioANull } from '../utils/formato';

// ---- Ayudantes comunes ----------------------------------------------------

/** true → 'Activo', false → 'Inactivo' */
export const estadoActivo = (activo) => (activo ? 'Activo' : 'Inactivo');

/** 'Inactivo' → false; cualquier otra cosa (incluido vacío al crear) → true */
export const activoDesdeEstado = (estado) => estado !== 'Inactivo';

/** Id de un registro de catálogo a partir del nombre elegido en un select. */
export function idPorNombre(lista, nombre, campo = 'nombre') {
  return lista.find((item) => item[campo] === nombre)?.id ?? null;
}

/** ¿Es una imagen que el navegador puede mostrar? (subida o con URL) */
const esImagen = (url) => typeof url === 'string' && /^(data:image\/|https?:\/\/)/.test(url);

/**
 * Para no reenviar fotos pesadas que no cambiaron: devuelve la imagen
 * nueva, null si se quitó, o undefined si sigue igual (la API la ignora).
 */
export function imagenCambiada(nueva, anterior) {
  const actual = nueva || null;
  return actual === (anterior || null) ? undefined : actual;
}

/** Fila de catálogo con interruptor Activo/Inactivo. */
export const conEstado = (fila) => ({ ...fila, estado: estadoActivo(fila.activo) });

// ---- Contactos ------------------------------------------------------------

export const clienteDesdeApi = conEstado;

export const clienteHaciaApi = (v) => ({
  tipoDocumento: v.tipoDocumento,
  numeroDocumento: String(v.numeroDocumento ?? '').trim(),
  nombreCompleto: v.nombreCompleto,
  telefono: vacioANull(v.telefono),
  correo: vacioANull(v.correo),
  direccion: vacioANull(v.direccion),
  activo: activoDesdeEstado(v.estado),
});

/** Proveedores y terceros (reencauchadoras) comparten los mismos campos. */
export const empresaExternaDesdeApi = conEstado;

export const empresaExternaHaciaApi = (v) => ({
  tipoDocumento: v.tipoDocumento,
  numeroDocumento: String(v.numeroDocumento ?? '').trim(),
  nombreRazonSocial: v.nombreRazonSocial,
  contacto: vacioANull(v.contacto),
  telefono: vacioANull(v.telefono),
  correo: vacioANull(v.correo),
  direccion: vacioANull(v.direccion),
  activo: activoDesdeEstado(v.estado),
});

// ---- Catálogo ---------------------------------------------------------------

export const categoriaHaciaApi = (v) => ({
  nombre: v.nombre,
  descripcion: vacioANull(v.descripcion),
  color: v.color || '#FBBF24',
  activo: activoDesdeEstado(v.estado),
});

export const marcaHaciaApi = (v) => ({ nombre: v.nombre, activo: activoDesdeEstado(v.estado) });

export const productoDesdeApi = (f) => ({
  ...f,
  estado: estadoActivo(f.activo),
  tipoVehiculo: f.tipoVehiculo ?? '',
  // Solo cuenta como foto una imagen real (subida o con URL)
  foto: esImagen(f.foto) ? f.foto : '',
  imagenes: esImagen(f.foto) ? [f.foto] : [],
});

// ---- Seguridad --------------------------------------------------------------

/** Los permisos viajan como lista; el formulario los maneja como "A, B, C". */
export const rolDesdeApi = (f) => ({ ...f, estado: estadoActivo(f.activo), permisos: f.permisos.join(', ') });

export const rolHaciaApi = (v) => ({
  nombre: v.nombre,
  descripcion: vacioANull(v.descripcion),
  permisos: String(v.permisos ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  activo: activoDesdeEstado(v.estado),
});

export const usuarioDesdeApi = conEstado;

// ---- Documentos ---------------------------------------------------------------

/**
 * Línea de detalle (cotización o venta). Si es un servicio con solicitud
 * de reencauche, trae también el estado de esa solicitud.
 */
export const lineaDesdeApi = (l) => ({
  lineaId: l.id,
  tipo: l.tipo,
  productoId: l.productoId ?? null,
  servicioId: l.servicioId ?? null,
  nombre: l.descripcion,
  codigo: l.codigoProducto ?? '',
  medida: l.medida ?? '',
  cantidad: l.cantidad,
  unitario: formatCOPoGuion(l.precioUnitario),
  subtotal: formatCOPoGuion(l.subtotal),
  precioUnitarioValor: l.precioUnitario ?? null,
  // Datos internos (solo llegan al personal): confirmación con el proveedor
  proveedorLineaId: l.proveedorLineaId ?? null,
  proveedorLinea: l.proveedorLinea ?? '',
  costoProveedor: l.costoProveedor ?? null,
  costoConfirmadoEn: l.costoConfirmadoEn ?? null,
  precioSugerido: l.precioSugerido ?? null,
  ultimoCosto: l.ultimoCosto ?? null,
  solicitud: l.solicitudServicio ?? '',
  estadoEvidencia: l.estadoEvidencia ?? '',
  foto: l.foto ?? '',
  // Datos de la solicitud de reencauche, para el portal
  solicitudDatos: l.solicitudServicio
    ? {
        id: l.solicitudServicio,
        servicio: l.servicio ?? l.descripcion,
        tercero: l.tercero ?? '',
        estado: l.estadoServicio,
        estadoEvidencia: l.estadoEvidencia,
        garantia: l.garantia ? 'Sí' : 'No',
        tiempoEstimado: l.tiempoEstimado ?? '',
        fecha: l.fechaServicio,
        medidas: l.medidasServicio ?? l.medida ?? '',
        cantidad: l.cantidadServicio ?? l.cantidad,
        descripcion: l.descripcionCarcasa ?? '',
        // Pago del servicio (se cobra aparte de la cotización)
        precio: l.precioServicio ?? null,
        precioTexto: l.precioServicio ? formatCOP(l.precioServicio) : 'Por definir',
        pagoEstado: l.pagoEstado ?? 'Sin precio',
        pagoMedio: l.pagoMedio ?? '',
        pagoComprobante: esImagen(l.pagoComprobante) ? l.pagoComprobante : '',
        pagoFecha: l.pagoFecha ?? '',
        pagoMotivo: l.pagoMotivo ?? '',
      }
    : null,
});

export const cotizacionDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  subtotal: formatCOP(f.subtotal),
  interes: formatCOP(f.interes),
  // Valor de la cotización: productos (más interés) y los servicios de
  // reencauche con el precio que les asignó el asesor
  total: formatCOP(f.total + (f.totalServicios ?? 0)),
  totalProductos: formatCOP(f.total),
  totalServicios: formatCOP(f.totalServicios ?? 0),
  conServicios: (f.totalServicios ?? 0) > 0,
  cuotaInicial: formatCOP(f.cuotaInicial),
  proveedor: f.proveedor ?? '',
  motivoCancelacion: f.motivoCancelacion ?? '',
  detalle: f.detalle?.map(lineaDesdeApi),
  // Pago de contado: estado de la consignación más reciente (null = no lleva)
  pagoEstado: f.pagoEstado ?? null,
  // Pendiente / Aprobado / Rechazado (contado o cuota inicial del crédito)
  estadoPago: f.estadoPago ?? null,
  // Solicitud / Emitida / Vencida / Aceptada, con las fechas de la cotización formal
  etapa: f.etapa ?? 'Aceptada',
  emitidaEn: f.emitidaEn ?? null,
  venceEn: f.venceEn ?? null,
  // El método de pago se elige al aceptar la cotización formal
  metodoPago: f.metodoPago ?? '',
  subtotalValor: f.subtotal,
  pagos: f.pagos?.map(pagoDesdeApi),
});

/** Una consignación del pago de contado de una cotización. */
export const pagoDesdeApi = (p) => ({
  ...p,
  monto: formatCOP(p.monto),
  comprobante: esImagen(p.comprobante) ? p.comprobante : '',
  motivo: p.motivo ?? '',
  fechaTexto: new Date(p.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }),
});

export const ventaDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  total: formatCOP(f.total),
  interes: formatCOP(f.interes),
  cuotaInicial: formatCOP(f.cuotaInicial),
  cotizacion: f.cotizacion ?? '',
  proveedor: f.proveedor ?? '',
  tercero: f.tercero ?? '',
  comprobantePago: f.comprobanteUrl ?? '',
  detalle: f.detalle?.map(lineaDesdeApi),
});

export const compraDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  total: formatCOP(f.total),
  cotizacion: f.cotizacion ?? '',
  detalle: f.detalle?.map((l) => ({
    producto: l.producto,
    codigo: l.codigoProducto,
    cantidad: l.cantidad,
    unitario: formatCOP(l.precioUnitario),
    subtotal: formatCOP(l.subtotal),
    origen: l.origen,
    // Costo confirmado con el proveedor en la cotización (null = sin confirmar)
    costoConfirmado: l.costoConfirmado == null ? null : formatCOP(l.costoConfirmado),
    costoConfirmadoEn: l.costoConfirmadoEn ?? null,
    proveedorConfirmado: l.proveedorConfirmado ?? '',
  })),
});

// ---- Cartera ------------------------------------------------------------------

export const abonoDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  monto: formatCOP(f.monto),
  metodoPago: f.medioPago,
  comprobante: f.comprobanteUrl ?? '',
});

export const creditoDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  montoTotal: formatCOP(f.montoTotal),
  saldoPendiente: formatCOP(f.saldoPendiente),
  // Los montos en número, para las cuentas (saldo usable, abonos…)
  montoTotalValor: f.montoTotal,
  saldoValor: f.saldoPendiente,
  estado: estadoActivo(f.activo),
  venta: f.venta ?? '',
  cotizacion: f.cotizacion ?? '',
  abonos: f.abonos?.map(abonoDesdeApi),
});

export const solicitudCreditoDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  monto: formatCOP(f.monto),
  motivo: f.motivo ?? '',
  // Cotización-pedido que la originó (las solicitudes sueltas no tienen)
  cotizacion: f.cotizacion ?? '',
  totalCotizacion: f.totalCotizacion != null ? formatCOP(f.totalCotizacion) : '',
  cuotaInicial: f.cuotaInicial != null ? formatCOP(f.cuotaInicial) : '',
  comprobante: esImagen(f.comprobante) ? f.comprobante : '',
  // Solo en el detalle (GET /solicitudes-credito/:numero)
  detalle: f.detalle?.map(lineaDesdeApi),
});

export const solicitudServicioDesdeApi = (f) => ({
  ...f,
  id: f.numero,
  tercero: f.tercero ?? '',
  medidas: f.medidas ?? '',
  tiempoEstimado: f.tiempoEstimado ?? '',
  foto: esImagen(f.foto) ? f.foto : '',
  // El formulario usa un interruptor Sí / No
  garantia: f.garantia ? 'Sí' : 'No',
  // Pago del servicio (se cobra aparte de la cotización)
  cotizacion: f.cotizacion ?? '',
  precio: f.precio ? formatCOP(f.precio) : '',
  precioSugerido: f.precioSugerido ? formatCOP(f.precioSugerido) : '',
  pagoEstado: f.pagoEstado ?? 'Sin precio',
  pagoMedio: f.pagoMedio ?? '',
  pagoComprobante: esImagen(f.pagoComprobante) ? f.pagoComprobante : '',
  pagoFecha: f.pagoFecha ?? '',
  pagoMotivo: f.pagoMotivo ?? '',
});

/** "$ 1.968.000" → 1968000, para enviar montos escritos en un formulario. */
export const montoHaciaApi = parseCOP;
