import { enviarDato } from './respuesta.view.js';

/**
 * Vista del portal del cliente: arma en una sola respuesta todo lo que
 * muestra el portal, con los indicadores del inicio ya calculados.
 */

/** Respuesta para alguien del personal que mira el portal: listas vacías. */
export function enviarResumenVacio(res) {
  enviarDato(res, {
    esCliente: false,
    cotizaciones: [],
    creditos: [],
    abonos: [],
    solicitudesCredito: [],
    estadisticas: null,
  });
}

/** Resumen completo del cliente en sesión. */
export function enviarResumen(res, { cotizaciones, lineas, creditos, abonos, solicitudesCredito, pagos }) {
  // Se reparten las líneas y los pagos de contado entre sus cotizaciones
  const conDetalle = cotizaciones.map((c) => ({
    ...c,
    detalle: lineas.filter((l) => l.cotizacionId === c.id),
    pagos: pagos.filter((p) => p.cotizacionId === c.id),
  }));

  // ---- Indicadores del inicio
  const enCamino = conDetalle.find((c) => c.estadoEntrega === 'En camino');
  const creditoAbierto = creditos.find((c) => c.saldoPendiente > 0);
  const anioActual = String(new Date().getFullYear());
  const totalComprado = conDetalle
    .filter((c) => c.estado === 'Completada' && String(c.fecha).startsWith(anioActual))
    .reduce((suma, c) => suma + c.total + c.totalServicios, 0);

  enviarDato(res, {
    esCliente: true,
    cotizaciones: conDetalle,
    creditos,
    abonos,
    solicitudesCredito,
    estadisticas: {
      totalCotizaciones: conDetalle.length,
      pendientes: conDetalle.filter((c) => c.estado === 'Pendiente').length,
      proximaEntrega: enCamino ? { numero: enCamino.numero, fecha: enCamino.fecha } : null,
      saldoCredito: creditoAbierto?.saldoPendiente ?? 0,
      totalComprado,
    },
  });
}
