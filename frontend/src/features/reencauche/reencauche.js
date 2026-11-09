// =========================================================================
// Piezas comunes del reencauche por banda (panel y portal): colores de cada
// diseño, tonos de los estados y textos que se repiten.
// =========================================================================

/** Color de cada diseño de banda (mismo lenguaje que los Badge). */
export const TONO_DISENO = {
  Direccional: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Tracción: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Mixta: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

/** Tono (clave de Badge) de cada estado de la solicitud. */
export const TONO_SOLICITUD = {
  'Por agendar': 'Pendiente',
  Agendada: 'Neutral',
  Cotizada: 'Emitida',
  Aceptada: 'Aceptada',
  'No aceptada': 'Inactivo',
  'Sin llantas aptas': 'Inactivo',
  Cancelada: 'Inactivo',
};

/** Tono (clave de Badge) de cada estado de la orden en la reencauchadora. */
export const TONO_ORDEN = {
  'Por enviar': 'Pendiente',
  'En planta': 'Neutral',
  'Lista para entregar': 'Pendiente',
  Entregada: 'Entregado',
  'Rechazada en planta': 'Rechazada',
};

/** Lo que ve el cliente de cada estado de su llanta. */
export const ESTADO_LLANTA_CLIENTE = {
  'Por enviar': 'Esperando envío',
  'En planta': 'En la reencauchadora',
  'Lista para entregar': 'Lista para entregar',
  Entregada: 'Entregada',
  'Rechazada en planta': 'No se pudo reencauchar',
};

export const llantasTexto = (n) => `${n} ${Number(n) === 1 ? 'llanta' : 'llantas'}`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-11-12' (o una fecha con hora) → '12 nov 2026' */
export function fechaCorta(iso) {
  if (!iso) return '';
  const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

/** ¿Ya terminaron todas sus llantas en la planta (entregadas o rechazadas)? */
export const terminada = (s) =>
  s.estado === 'Aceptada' && s.llantas.length > 0 && s.enProceso === 0;

/** Pasos que ve el cliente, en orden. */
export const PASOS = ['Solicitud', 'Revisión gratis', 'Cotización', 'Reencauchadora', 'Entrega y pago'];

/** Paso actual de una solicitud (5 = todo terminado). */
export function pasoActual(s) {
  if (s.estado === 'Por agendar' || s.estado === 'Agendada') return 1;
  if (s.estado === 'Cotizada') return 2;
  if (s.estado !== 'Aceptada') return 2;
  if (terminada(s)) return 5;
  return s.listas > 0 ? 4 : 3;
}

/** Estado de la solicitud contado al cliente. */
export function estadoParaCliente(s) {
  switch (s.estado) {
    case 'Por agendar':
      return { texto: 'Por agendar revisión', tono: 'Pendiente' };
    case 'Agendada':
      return { texto: 'Revisión agendada', tono: 'Neutral' };
    case 'Cotizada':
      return { texto: 'Por aceptar', tono: 'Pendiente' };
    case 'Aceptada':
      if (terminada(s)) return { texto: 'Terminado', tono: 'Completado' };
      return s.listas > 0
        ? { texto: 'Lista para entregar', tono: 'Pendiente' }
        : { texto: 'En la reencauchadora', tono: 'Neutral' };
    default:
      return { texto: s.estado, tono: 'Inactivo' };
  }
}
