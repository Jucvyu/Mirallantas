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
// Listas que viven en la base de datos (tablas tipo_documento y metodo_pago).
// Empiezan vacías y se llenan al abrir la app con GET /api/referencias (ver
// services/referencias.service.js y main.jsx).
// Se llenan "en el mismo arreglo", así que cualquier formulario que las
// importe ve los datos de la base.
// -------------------------------------------------------------------------

/** Códigos de documento: CC, CE, NIT, Pasaporte… */
export const tiposDocumento = [];

/** Métodos con los que se pacta una venta (tipo "forma"): Contado o Crédito. */
export const metodosPago = [];

/** Métodos con los que se paga un abono o la cuota inicial (tipo "medio"). */
export const mediosPago = [];

/** Estados de la solicitud de crédito con los que ya se puede pagar la cuota inicial. */
export const SOLICITUD_CREDITO_APROBADA = ['Pendiente de cuota inicial', 'Aprobada'];

/** Abono mínimo de un crédito (el último pago, por el saldo exacto, puede ser menor). */
export const ABONO_MINIMO = 20000;

/** Diseños de banda de reencauche: [{ nombre, descripcion }] (tabla diseno_banda). */
export const disenosBanda = [];

/** Plazos de financiación (en días) e interés que suma cada uno. */
export const PLAZOS_CREDITO = [30, 60, 90];
// 3,3 % fijo sobre el total, sea a 30, 60 o 90 días
export const INTERES_POR_PLAZO = { 30: 0.033, 60: 0.033, 90: 0.033 };

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

export const estadosCotizacion = ['Pendiente', 'En proceso', 'Completada', 'Rechazada'];
export const FLUJO_ESTADOS_COTIZACION = {
  // Al confirmarse el pago pasa sola a "En proceso"; al terminar compra y
  // reencauche se completa sola.
  Pendiente: ['En proceso', 'Rechazada'],
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

// -------------------------------------------------------------------------
// Reencauche por banda (copia de las reglas de backend/src/reglas.js).
// La banda solo se vende con el servicio, la revisión es gratis y cada
// llanta se cobra cuando la reencauchadora la entrega terminada.
// -------------------------------------------------------------------------

/** Llantas por solicitud y días máximos para agendar la revisión. */
export const LLANTAS_POR_REENCAUCHE = 20;
export const DIAS_MAXIMOS_REVISION = 60;

/** Estados de la solicitud de reencauche, en el orden en que suceden. */
export const estadosReencauche = ['Por agendar', 'Agendada', 'Cotizada', 'Aceptada', 'No aceptada', 'Sin llantas aptas', 'Cancelada'];

/** Estados de cada llanta en la reencauchadora (su orden). */
export const estadosOrdenReencauche = ['Por enviar', 'En planta', 'Lista para entregar', 'Entregada', 'No pagada', 'Rechazada en planta'];

/** Días que espera una llanta lista sin pago antes de pasar sola al catálogo (igual que la API). */
export const DIAS_PARA_NO_PAGADA = 30;

export const estadosAbono = ['Pendiente', 'Confirmado', 'Rechazado'];

// El estado no se cambia a mano: aprobar la solicitud la deja "Pendiente de
// cuota inicial" (si la lleva) y pasa sola a "Aprobada" al confirmarse ese pago
export const estadosSolicitudCredito = ['Pendiente', 'Pendiente de cuota inicial', 'Aprobada', 'Rechazada'];

/** Cartera de un crédito que espera la cuota inicial para empezar. */
export const CREDITO_SIN_INICIAR = 'Pendiente de cuota inicial';
