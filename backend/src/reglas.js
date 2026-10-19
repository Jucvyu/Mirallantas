import { HttpError } from './errores.js';

/**
 * Reglas del negocio de MiraLlantas.
 *
 * Están todas aquí para que sea fácil encontrarlas y cambiarlas. El
 * frontend tiene una copia para mostrar los cálculos mientras el usuario
 * escribe (src/constantes.js); si cambias un valor aquí, cámbialo allá
 * también. La que manda siempre es esta: el servidor vuelve a calcular y
 * a validar todo antes de guardar.
 */

/** Interés que se suma al total según el plazo del crédito (en días). */
export const INTERES_POR_PLAZO = { 30: 0.03, 60: 0.06, 90: 0.09 };

export const PLAZOS_CREDITO = [30, 60, 90];

/** La primera cuota de una compra a crédito debe cubrir al menos el 50 %. */
export const CUOTA_INICIAL_CREDITO = 0.5;

/** Cupo máximo de crédito de cada cliente, en pesos. */
export const CUPO_CARTERA = 2_000_000;

/** Servicio que se asume cuando el cliente pide un reencauche. */
export const SERVICIO_POR_DEFECTO = 'Reencauche';

// Los métodos de pago (Contado, Crédito), los medios de pago y los tipos de
// documento viven en la base de datos (tablas metodo_pago, medio_pago y
// tipo_documento). Las reglas de aquí usan sus nombres: 'Crédito', 'Efectivo'…
export const ESTADOS_EVIDENCIA = ['Pendiente de revisión', 'Apta', 'No apta'];

/**
 * Flujos de estado: desde cada estado, a cuáles se puede pasar. Un estado
 * con lista vacía es final (no se puede cambiar).
 */
export const FLUJOS = {
  cotizacion: {
    Pendiente: ['Aprobada', 'Rechazada'],
    Aprobada: ['En proceso', 'Rechazada'],
    'En proceso': ['Completada'],
    Completada: [],
    Rechazada: [],
  },
  venta: {
    Pendiente: ['Completada', 'Anulada'],
    Completada: ['Anulada'],
    Anulada: [],
  },
  compra: {
    Pendiente: ['Recibida', 'Anulada'],
    Recibida: [],
    Anulada: [],
  },
  entrega: {
    Pendiente: ['En camino', 'Cancelado'],
    'En camino': ['Entregado', 'Cancelado'],
    Entregado: [],
    Cancelado: [],
  },
  servicio: {
    Pendiente: ['En proceso', 'Cancelado'],
    'En proceso': ['Completado', 'Cancelado'],
    Completado: [],
    Cancelado: [],
  },
  abono: {
    Pendiente: ['Confirmado', 'Rechazado'],
    Confirmado: [],
    Rechazado: [],
  },
  solicitudCredito: {
    Pendiente: ['Aprobada', 'Rechazada'],
    Aprobada: [],
    Rechazada: [],
  },
};

/** Lista de todos los estados de un flujo, para validar los valores. */
export const estadosDe = (flujo) => Object.keys(FLUJOS[flujo]);

/**
 * Comprueba que se pueda pasar de `actual` a `siguiente`. Si no se puede,
 * lanza un error 422 con un mensaje que el usuario entiende.
 */
export function validarTransicion(flujo, actual, siguiente) {
  if (actual === siguiente) return;
  const permitidos = FLUJOS[flujo][actual] ?? [];
  if (!permitidos.includes(siguiente)) {
    const opciones = permitidos.length ? permitidos.join(' o ') : 'ningún otro estado';
    throw new HttpError(422, `No se puede pasar de "${actual}" a "${siguiente}". Desde "${actual}" solo se pasa a ${opciones}.`);
  }
}

/**
 * Valores de una cotización a partir del subtotal de sus líneas.
 * Con crédito se suma el interés del plazo y se exige la cuota inicial.
 */
export function calcularTotales(subtotal, metodoPago, plazoDias) {
  const esCredito = metodoPago === 'Crédito';
  const interes = esCredito ? Math.round(subtotal * (INTERES_POR_PLAZO[plazoDias] ?? 0)) : 0;
  const total = subtotal + interes;
  const cuotaMinima = esCredito ? Math.round(total * CUOTA_INICIAL_CREDITO) : 0;
  return { interes, total, cuotaMinima };
}

/** Texto de una cifra en pesos, para los mensajes: 1500000 → "$ 1.500.000". */
export const pesos = (valor) => `$ ${Number(valor || 0).toLocaleString('es-CO')}`;
