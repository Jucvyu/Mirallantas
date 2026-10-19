// =========================================================================
// Servicios de la cartera: créditos, abonos, solicitudes de crédito y
// solicitudes de servicio (reencauche).
// =========================================================================

import {
  abonoDesdeApi,
  creditoDesdeApi,
  idPorNombre,
  imagenCambiada,
  solicitudCreditoDesdeApi,
  solicitudServicioDesdeApi,
} from './adaptadores';
import { api, conClave } from './http';
import { crearServicio } from './recurso';
import { parseCOP, vacioANull } from '../utils/formato';

// ---- Créditos -------------------------------------------------------------------

/** Formulario "Nuevo crédito": { cotizacion, valor, plazo } → cuerpo de la API. */
const creditoHaciaApi = (v) => ({ cotizacion: v.cotizacion, montoTotal: parseCOP(v.valor), plazoDias: v.plazo });

const creditosBase = crearServicio({ ruta: '/creditos', desdeApi: creditoDesdeApi, haciaApi: creditoHaciaApi });

export const creditosService = {
  ...creditosBase,

  /** Activa o desactiva un crédito. */
  cambiarEstado: (fila, estado) => creditosBase.enviar(fila, { activo: estado === 'Activo' }),

  /**
   * Registra un abono a un crédito (lo usan el asesor y el cliente dueño).
   * Queda "Pendiente" hasta que un asesor lo confirme.
   *   datos: { credito, monto, medioPago, comprobante, claveIdempotencia }
   */
  async registrarAbono({ credito, monto, medioPago, comprobante, claveIdempotencia }) {
    const { datos } = await api(`/creditos/${encodeURIComponent(credito)}/abonos`, {
      metodo: 'POST',
      cuerpo: { monto, medioPago, comprobante: comprobante || null },
      // Si el envío se repite, la API devuelve el mismo abono en vez de duplicarlo
      cabecerasExtra: conClave(claveIdempotencia),
    });
    return datos;
  },
};

// ---- Abonos ---------------------------------------------------------------------

/** Edición de un abono pendiente: solo se envía lo que cambió, más el estado. */
const abonoHaciaApi = (v, fila) => ({
  ...(parseCOP(v.monto) !== parseCOP(fila.monto) ? { monto: parseCOP(v.monto) } : {}),
  ...(v.metodoPago !== fila.metodoPago ? { medioPago: v.metodoPago } : {}),
  estado: v.estado,
});

const abonosBase = crearServicio({ ruta: '/abonos', desdeApi: abonoDesdeApi, haciaApi: abonoHaciaApi, metodoEditar: 'PATCH' });

export const abonosService = {
  ...abonosBase,
  /** Un abono nuevo siempre se registra sobre su crédito. */
  crear: (datos) => creditosService.registrarAbono(datos),
  /**
   * Confirmar o rechazar (al confirmar, la API descuenta el saldo). Al
   * rechazar, `motivo` le explica al cliente por qué debe volver a subirlo.
   */
  cambiarEstado: (fila, estado, motivo) => abonosBase.enviar(fila, { estado, motivo: motivo || undefined }),
};

// ---- Solicitudes de crédito ---------------------------------------------------------

/** Al crear: cliente, monto y plazo. Al revisar: estado y motivo. */
function solicitudCreditoHaciaApi(v, fila, contexto) {
  if (fila) return { estado: v.estado, motivo: vacioANull(v.motivo) };
  return {
    // Desde el portal no hay cliente que elegir: la API usa el de la sesión
    clienteId: contexto?.clientes ? idPorNombre(contexto.clientes, v.cliente, 'nombreCompleto') : undefined,
    monto: parseCOP(v.monto),
    plazoDias: Number(v.plazoDias),
  };
}

const solicitudesCreditoBase = crearServicio({
  ruta: '/solicitudes-credito',
  desdeApi: solicitudCreditoDesdeApi,
  haciaApi: solicitudCreditoHaciaApi,
  metodoEditar: 'PATCH',
});

export const solicitudesCreditoService = {
  ...solicitudesCreditoBase,
  /** Aprobar (abre el crédito) o rechazar (exige motivo). */
  cambiarEstado: (fila, estado) => solicitudesCreditoBase.enviar(fila, { estado }),
  /** No aprobar con su motivo (la cotización se rechaza y el stock vuelve). */
  rechazar: (fila, motivo) => solicitudesCreditoBase.enviar(fila, { estado: 'Rechazada', motivo }),
};

// ---- Solicitudes de servicio (reencauche) --------------------------------------------

/** Formulario → API: los nombres elegidos viajan como ids. */
function solicitudServicioHaciaApi(v, fila, { clientes, terceros }) {
  return {
    ...(fila ? { estado: v.estado } : { clienteId: idPorNombre(clientes, v.cliente, 'nombreCompleto') }),
    // El servicio no se elige: siempre es "Reencauche" (lo pone la API)
    terceroId: idPorNombre(terceros, v.tercero, 'nombreRazonSocial'),
    fecha: vacioANull(v.fecha) ?? undefined,
    cantidad: Number(v.cantidad),
    medidas: vacioANull(v.medidas),
    descripcion: v.descripcion,
    foto: imagenCambiada(v.foto, fila?.foto),
    estadoEvidencia: v.estadoEvidencia || undefined,
    tiempoEstimado: vacioANull(v.tiempoEstimado),
    garantia: v.garantia === 'Sí' || v.garantia === true,
    // El valor del servicio solo viaja si se escribió o cambió
    ...(fila && parseCOP(v.precio) && parseCOP(v.precio) !== parseCOP(fila.precio) ? { precio: parseCOP(v.precio) } : {}),
  };
}

const solicitudesServicioBase = crearServicio({
  ruta: '/solicitudes-servicio',
  desdeApi: solicitudServicioDesdeApi,
  haciaApi: solicitudServicioHaciaApi,
  metodoEditar: 'PATCH',
});

export const solicitudesServicioService = {
  ...solicitudesServicioBase,
  cambiarEstado: (fila, estado) => solicitudesServicioBase.enviar(fila, { estado }),
  /** Asigna el valor del servicio (el cliente recibe el aviso para pagarlo). */
  asignarPrecio: (fila, precio) => solicitudesServicioBase.enviar(fila, { precio }),
  /** Aprobar o rechazar el pago del servicio (rechazar exige el motivo). */
  revisarPago: (fila, estado, motivo) =>
    solicitudesServicioBase.enviar(fila, { estado, motivo: motivo || undefined }, { metodo: 'POST', sufijo: '/pago' }),
};
