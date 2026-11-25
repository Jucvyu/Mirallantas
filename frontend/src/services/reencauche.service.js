// =========================================================================
// Servicios del reencauche por banda.
//
//   bandasService               catálogo de bandas (panel)
//   reencauchesService          solicitudes: agenda, revisión y respuesta (panel)
//   ordenesReencaucheService    cada llanta en la reencauchadora y su cobro (panel)
//   portalReencaucheService     bandas, mis solicitudes y respuestas (portal)
// =========================================================================

import { activoDesdeEstado, estadoActivo } from './adaptadores';
import { conCambioDeEstado } from './catalogos.service';
import { api, traerTodo } from './http';
import { crearServicio } from './recurso';
import { formatCOP, parseCOP, vacioANull } from '../utils/formato';

/** Lugar de la revisión: así se muestra en los formularios. */
export const LUGAR_LOCAL = 'En el local';
export const LUGAR_CLIENTE = 'Donde el cliente';

/** "295/80r22.5, 11R22.5" → ['295/80R22.5', '11R22.5'] (sin repetidas). */
export const listaDeMedidas = (texto) => [
  ...new Set(
    String(texto ?? '')
      .split(',')
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean),
  ),
];

/** 470000 → "470.000" (lo que muestra un campo de dinero). */
const miles = (valor) => (valor == null ? '' : Number(valor).toLocaleString('es-CO'));

// ---- Bandas -------------------------------------------------------------------

export const bandaDesdeApi = (b) => ({
  ...b,
  estado: estadoActivo(b.activo),
  profundidadMm: String(b.profundidadMm),
  medidas: b.medidas ?? [],
  medidasTexto: (b.medidas ?? []).join(', '),
  // El precio solo llega al personal
  precio: miles(b.precio),
  precioValor: b.precio ?? null,
});

const bandaHaciaApi = (v, fila) => ({
  nombre: v.nombre,
  diseno: v.diseno,
  tipoVehiculoId: Number(v.tipoVehiculoId),
  anchoMm: Number(v.anchoMm),
  profundidadMm: Number(String(v.profundidadMm).replace(',', '.')),
  medidas: listaDeMedidas(v.medidasTexto),
  precio: parseCOP(v.precio),
  ...(fila ? { activo: activoDesdeEstado(v.estado) } : {}),
});

export const bandasService = conCambioDeEstado(
  crearServicio({ ruta: '/bandas', desdeApi: bandaDesdeApi, haciaApi: bandaHaciaApi }),
);

// ---- Solicitudes ----------------------------------------------------------------

const llantaDesdeApi = (l) => ({ ...l, valorTexto: formatCOP(l.valor) });

/** "Banda A · 3 llantas 295/80R22.5 + Banda B · 2 llantas 11R22.5" (resumen corto de lo pedido). */
const resumenItems = (items) =>
  items.map((i) => `${i.banda} · ${i.cantidad} ${i.cantidad === 1 ? 'llanta' : 'llantas'} ${i.medida}`).join(' + ');

export const reencaucheDesdeApi = (r) => {
  // Las líneas pedidas (como un carro). Si no llegan, la única es la de la solicitud
  const items = r.items?.length
    ? r.items
    : [{ posicion: 1, bandaId: r.bandaId, banda: r.banda, diseno: r.diseno, anchoMm: r.anchoMm, medida: r.medida, cantidad: r.cantidad }];
  return {
  ...r,
  id: r.numero,
  items,
  pedidoTexto: resumenItems(items),
  direccion: r.direccion ?? '',
  notas: r.notas ?? '',
  valorTexto: formatCOP(r.valor),
  cobradoTexto: formatCOP(r.cobrado),
  llantas: (r.llantas ?? []).map(llantaDesdeApi),
  };
};

/** Formulario de solicitud → cuerpo de la API. `items`: [{ bandaId, medida, cantidad }]. */
const solicitudHaciaApi = (v) => {
  const enLocal = v.lugar === LUGAR_LOCAL;
  return {
    items: v.items.map((i) => ({ bandaId: Number(i.bandaId), medida: i.medida, cantidad: Number(i.cantidad) })),
    lugar: enLocal ? 'Local' : 'Cliente',
    direccion: enLocal ? null : vacioANull(v.direccion),
    fechaPreferida: v.fechaPreferida,
    notas: vacioANull(v.notas),
  };
};

/** Llanta del formulario de revisión → cuerpo de la API. */
const llantaHaciaApi = (l) => {
  const apta = l.resultado === 'Apta';
  return {
    medida: l.medida,
    reencauchesPrevios: Number(l.reencauchesPrevios) || 0,
    resultado: l.resultado,
    motivoNoApta: apta ? undefined : vacioANull(l.motivoNoApta),
    bandaId: apta ? Number(l.bandaId) || undefined : undefined,
    precioBanda: apta ? parseCOP(l.precioBanda) || undefined : undefined,
    manoObra: apta ? parseCOP(l.manoObra) || undefined : undefined,
  };
};

const enviar = async (ruta, cuerpo) => (await api(ruta, { metodo: 'POST', cuerpo }))?.datos;
const ruta = (numero, sufijo) => `/reencauches/${encodeURIComponent(numero)}${sufijo}`;

export const reencauchesService = {
  async listar() {
    return (await traerTodo('/reencauches')).map(reencaucheDesdeApi);
  },
  async obtener(numero) {
    const { datos } = await api(ruta(numero, ''));
    return reencaucheDesdeApi(datos);
  },
  /** El asesor registra la solicitud de un cliente. */
  async crear(valores) {
    return enviar('/reencauches', { clienteId: Number(valores.clienteId), ...solicitudHaciaApi(valores) });
  },
  agendar: (numero, fechaRevision) => enviar(ruta(numero, '/agenda'), { fechaRevision }),
  /** El cliente aceptó por teléfono (o en el local) la fecha que se le propuso. */
  confirmarFecha: (numero) => enviar(ruta(numero, '/confirmar-fecha')),
  registrarRevision: (numero, llantas) => enviar(ruta(numero, '/revision'), { llantas: llantas.map(llantaHaciaApi) }),
  /** El cliente responde la cotización en el local. */
  responder: (numero, acepta) => enviar(ruta(numero, '/respuesta'), { acepta }),
  cancelar: (numero, motivo) => enviar(ruta(numero, '/cancelar'), { motivo }),
};

// ---- Órdenes en la reencauchadora ---------------------------------------------------

const rutaOrden = (id, sufijo) => `/reencauches/ordenes/${encodeURIComponent(id)}${sufijo}`;

export const ordenesReencaucheService = {
  async listar() {
    return (await traerTodo('/reencauches/ordenes')).map(llantaDesdeApi);
  },
  enviar: (orden, terceroId) => enviar(rutaOrden(orden.id, '/envio'), { terceroId: Number(terceroId) }),
  marcarLista: (orden) => enviar(rutaOrden(orden.id, '/lista')),
  rechazar: (orden, motivo) => enviar(rutaOrden(orden.id, '/rechazo'), { motivo }),
  /** El cliente no la pagó: pasa al catálogo con el precio que digita el asesor. */
  noPagada: (orden, { precioVenta, motivo }) =>
    enviar(rutaOrden(orden.id, '/no-pagada'), { precioVenta: parseCOP(precioVenta), motivo: vacioANull(motivo) }),
  /** Se entrega y se cobra: es el único momento en que se recibe dinero (por transferencia, con su comprobante). */
  entregar: (orden, { medioPago, comprobante }) =>
    enviar(rutaOrden(orden.id, '/entrega'), { medioPago, comprobante: comprobante || null }),
};

// ---- Portal ---------------------------------------------------------------------------

const rutaPortal = (numero, sufijo) => `/portal/reencauches/${encodeURIComponent(numero)}${sufijo}`;

export const portalReencaucheService = {
  /** Bandas que se ofrecen (sin precio: el valor se da después de revisar). */
  async bandas() {
    const { datos } = await api('/portal/bandas');
    return datos.map(bandaDesdeApi);
  },
  /** Mis solicitudes con sus llantas. */
  async listar() {
    const { datos } = await api('/portal/reencauches');
    return datos.map(reencaucheDesdeApi);
  },
  solicitar: (valores) => enviar('/portal/reencauches', solicitudHaciaApi(valores)),
  responder: (numero, acepta) => enviar(rutaPortal(numero, '/respuesta'), { acepta }),
  /** Acepta la fecha de revisión que propuso el asesor. */
  confirmarFecha: (numero) => enviar(rutaPortal(numero, '/fecha')),
  cancelar: (numero, motivo) => enviar(rutaPortal(numero, '/cancelar'), { motivo }),
};
