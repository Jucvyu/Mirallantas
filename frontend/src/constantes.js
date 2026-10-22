// =========================================================================
// Constantes del negocio que usa el frontend.
//
// Aquí están los estados y sus flujos, las reglas que se muestran mientras
// el usuario escribe (interés, cuota inicial) y las listas que se
// cargan desde la base al iniciar.
// Los DATOS (clientes, productos, cotizaciones…) ya no viven en el
// frontend: se piden a la API.
//
// ⚠️ Las reglas de dinero son copia de backend/src/reglas.js. El servidor
// vuelve a calcular y validar todo; si cambias un valor aquí, cámbialo
// también allá (y al revés), o la pantalla mostrará cifras distintas.
// =========================================================================

// -------------------------------------------------------------------------
// Listas que viven en la base de datos (tablas tipo_documento, metodo_pago
// y medio_pago). Empiezan vacías y se llenan al abrir la app con
// GET /api/referencias (ver services/referencias.service.js y main.jsx).
// Se llenan "en el mismo arreglo", así que cualquier formulario que las
// importe ve los datos de la base.
// -------------------------------------------------------------------------

/** Códigos de documento: CC, CE, NIT, Pasaporte… */
export const tiposDocumento = [];

/** Forma en que se pacta el pago de una venta: Contado o Crédito. */
export const metodosPago = [];

/** Medio concreto con el que se paga un abono o la cuota inicial. */
export const mediosPago = [];

/** Plazos de financiación (en días) e interés que suma cada uno. */
export const PLAZOS_CREDITO = [30, 60, 90];
export const INTERES_POR_PLAZO = { 30: 0.03, 60: 0.06, 90: 0.09 };

/**
 * Venta a crédito: cuota inicial de al menos el 30 % del total (el 70 %
 * restante se financia). De contado se paga el 100 %.
 */
export const CUOTA_INICIAL_PORCENTAJE = 30;
export const CUOTA_INICIAL_CREDITO = CUOTA_INICIAL_PORCENTAJE / 100;

/** Cuota inicial mínima: 30 % redondeado hacia arriba (igual que la API). */
export const cuotaMinimaDe = (total) => Math.ceil((total * CUOTA_INICIAL_PORCENTAJE) / 100);

/** Días calendario de vigencia de una cotización formal (los calcula la API). */
export const VIGENCIA_COTIZACION_DIAS = 8;

/**
 * Ganancia sugerida sobre el precio de compra: al escribir lo que cobra el
 * proveedor, el precio de venta se propone con este margen (el administrador
 * lo puede cambiar). 0.2 = 20 %.
 */
export const GANANCIA_SUGERIDA = 0.2;

/** Precio de venta sugerido para un precio de compra (redondeado al peso). */
export const ventaSugerida = (compra) => Math.round(compra * (1 + GANANCIA_SUGERIDA));

/** Plazo de respuesta para confirmar los precios de una solicitud. */
export const PLAZO_RESPUESTA_HORAS = 24;

/** Medios con los que paga un cliente desde el portal (la API también lo exige). */
export const MEDIOS_PAGO_CLIENTE = ['Efectivo', 'Transferencia'];

/** Etapas comerciales de una cotización (las calcula la API). */
export const ETAPAS_COTIZACION = ['Solicitud', 'Emitida', 'Vencida', 'Aceptada'];


/** Servicio que se asume cuando el cliente pide un reencauche. */
export const SERVICIO_POR_DEFECTO = 'Reencauche';

// -------------------------------------------------------------------------
// Estados y flujos: desde cada estado, a cuáles se puede pasar.
// Un estado con lista vacía es final.
// -------------------------------------------------------------------------

export const estadosActivo = ['Activo', 'Inactivo'];

export const estadosCotizacion = ['Pendiente', 'Aprobada', 'En proceso', 'Completada', 'Rechazada'];
export const FLUJO_ESTADOS_COTIZACION = {
  Pendiente: ['Aprobada', 'Rechazada'],
  Aprobada: ['En proceso'],
  'En proceso': ['Completada'],
  Completada: [],
  Rechazada: [],
};

/** Al llegar a este estado, la cotización genera la venta automáticamente. */
export const ESTADO_COTIZACION_COMPLETADA = 'Completada';

export const estadosVenta = ['Pendiente', 'Completada', 'Anulada'];
export const FLUJO_ESTADOS_VENTA = {
  Pendiente: ['Completada', 'Anulada'],
  Completada: ['Anulada'],
  Anulada: [],
};

export const estadosCompra = ['Pendiente', 'Recibida', 'Anulada'];
export const FLUJO_ESTADOS_COMPRA = {
  Pendiente: ['Recibida', 'Anulada'],
  Recibida: [],
  Anulada: [],
};

/** Despacho al cliente (cotización y venta) o recepción del proveedor (compra). */
export const estadosEntrega = ['Pendiente', 'En camino', 'Entregado', 'Cancelado'];

/** Estado de pago de una cotización (contado o cuota inicial del crédito). */
export const ESTADOS_PAGO = ['Pendiente', 'Aprobado', 'Rechazado'];

export const FLUJO_ESTADOS_ENTREGA = {
  Pendiente: ['En camino', 'Cancelado'],
  'En camino': ['Entregado', 'Cancelado'],
  Entregado: [],
  Cancelado: [],
};

/** Solicitud de servicio de reencauche. */
export const estadosServicio = ['Pendiente', 'En proceso', 'Completado', 'Cancelado'];
export const FLUJO_ESTADOS_SERVICIO = {
  Pendiente: ['En proceso', 'Cancelado'],
  'En proceso': ['Completado', 'Cancelado'],
  Completado: [],
  Cancelado: [],
};

/** Revisión de la carcasa antes de aceptarla para reencauche. */
export const estadosEvidenciaCarcasa = ['Pendiente de revisión', 'Apta', 'No apta'];

export const estadosAbono = ['Pendiente', 'Confirmado', 'Rechazado'];
export const FLUJO_ESTADOS_ABONO = {
  Pendiente: ['Confirmado', 'Rechazado'],
  Confirmado: [],
  Rechazado: [],
};

export const estadosSolicitudCredito = ['Pendiente', 'Aprobada', 'Rechazada'];
export const FLUJO_ESTADOS_SOLICITUD_CREDITO = {
  Pendiente: ['Aprobada', 'Rechazada'],
  Aprobada: [],
  Rechazada: [],
};
