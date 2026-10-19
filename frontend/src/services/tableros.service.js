// =========================================================================
// Servicios de los tableros: dashboard del administrador y resumen del
// portal del cliente.
// =========================================================================

import { abonoDesdeApi, cotizacionDesdeApi, creditoDesdeApi, solicitudCreditoDesdeApi } from './adaptadores';
import { api } from './http';

export const dashboardService = {
  /** Indicadores del tablero, calculados por la API con datos reales. */
  async obtener() {
    const { datos } = await api('/dashboard');
    return datos;
  },
};

export const portalService = {
  /**
   * Todo lo que muestra el portal del cliente en sesión, ya convertido al
   * formato de las pantallas. Cada cotización trae además cuántas llantas
   * suma (`items`), que usan las tarjetas.
   */
  async resumen() {
    const { datos } = await api('/portal/resumen');
    return {
      esCliente: datos.esCliente,
      cupoTotal: datos.cupoTotal,
      cotizaciones: datos.cotizaciones.map((c) => ({
        ...cotizacionDesdeApi(c),
        items: c.detalle.reduce((suma, l) => suma + l.cantidad, 0),
      })),
      creditos: datos.creditos.map(creditoDesdeApi),
      abonos: datos.abonos.map(abonoDesdeApi),
      solicitudesCredito: datos.solicitudesCredito.map(solicitudCreditoDesdeApi),
      estadisticas: datos.estadisticas,
    };
  },

  /**
   * Paga un servicio de reencauche (o vuelve a subir el comprobante si el
   * pago anterior fue rechazado). Queda "En revisión" hasta que el asesor
   * lo apruebe.
   */
  pagarServicio(numero, { medioPago, comprobante }) {
    return api(`/portal/servicios/${encodeURIComponent(numero)}/pago`, {
      metodo: 'POST',
      cuerpo: { medioPago, comprobante: comprobante || undefined },
    });
  },
};

// ---- Notificaciones del cliente ----------------------------------------------------

export const notificacionesService = {
  /** Las recientes y cuántas faltan por leer: { notificaciones, sinLeer }. */
  async listar() {
    const { datos } = await api('/portal/notificaciones');
    return datos;
  },

  /** Marca todas como leídas (al abrir la campana). */
  marcarLeidas() {
    return api('/portal/notificaciones/leidas', { metodo: 'POST' });
  },
};

// ---- Avisos del personal (por ahora, solo de Pedidos-Cotización) --------------------

export const avisosPersonalService = {
  /** Los de los módulos que el rol tiene permitidos: { notificaciones, sinLeer }. */
  async listar() {
    const { datos } = await api('/notificaciones');
    return datos;
  },

  /** Marca todos como vistos (al abrir la campana). */
  marcarLeidas() {
    return api('/notificaciones/leidas', { metodo: 'POST' });
  },
};
