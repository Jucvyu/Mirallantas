// =========================================================================
// Constantes del negocio que usa el frontend.
//
// Aquí están los estados y sus flujos, las reglas que se muestran mientras
// el usuario escribe (interés, cuota inicial, cupo) y las listas que se
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

/** La primera cuota de una compra a crédito debe cubrir al menos el 50 %. */
export const CUOTA_INICIAL_CREDITO = 0.5;

/** Cupo máximo de crédito de cada cliente, en pesos. */
export const CUPO_CARTERA = 2000000;

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
  Aprobada: ['En proceso', 'Rechazada'],
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
