import { z } from 'zod';
import { DIAS_MAXIMOS_REVISION, LLANTAS_POR_REENCAUCHE } from '../reglas.js';
import {
  hoyNegocio,
  idRelacion,
  listadoCon,
  medioPago,
  objetoEstricto,
  pesosPositivos,
  texto,
  textoOpcional,
} from './comunes.validator.js';

/**
 * Validación del reencauche por banda: el catálogo de bandas, la solicitud
 * del cliente, la revisión de cada llanta y la orden en la reencauchadora.
 */

// ---- Piezas -------------------------------------------------------------------

/** Medida de llanta: 295/80R22.5, 11R22.5, 215/75R17.5… */
const medida = z
  .string({ error: 'Escribe la medida de la llanta.' })
  .trim()
  .toUpperCase()
  .regex(/^[0-9][0-9A-Z./ -]{2,19}$/, 'La medida no es válida (por ejemplo, 295/80R22.5).');

/** Días entre hoy y una fecha AAAA-MM-DD (en UTC para no correr un día). */
const diasDesdeHoy = (valor) => (Date.parse(`${valor}T00:00:00Z`) - Date.parse(`${hoyNegocio()}T00:00:00Z`)) / 86_400_000;

/** Fecha de una revisión: de hoy en adelante, como máximo dos meses. */
const fechaRevision = z
  .string({ error: 'Elige la fecha de la revisión.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.')
  .refine((valor) => diasDesdeHoy(valor) >= 0, { error: 'La fecha de la revisión no puede ser anterior a hoy.' })
  .refine((valor) => diasDesdeHoy(valor) <= DIAS_MAXIMOS_REVISION, {
    error: `La revisión se agenda con máximo ${DIAS_MAXIMOS_REVISION} días de anticipación.`,
  });

const llantas = z.coerce
  .number()
  .int('La cantidad de llantas debe ser un número entero.')
  .min(1, 'Revisamos al menos una llanta.')
  .max(LLANTAS_POR_REENCAUCHE, `Cada solicitud admite hasta ${LLANTAS_POR_REENCAUCHE} llantas.`);

// ---- Bandas -------------------------------------------------------------------

const camposBanda = {
  nombre: texto(80),
  // Que el diseño exista lo garantiza la llave foránea (tabla diseno_banda)
  diseno: z.string({ error: 'Elige el diseño de la banda.' }).trim().min(1, 'Elige el diseño de la banda.').max(30),
  tipoVehiculoId: idRelacion,
  anchoMm: z.coerce
    .number({ error: 'Escribe el ancho de la banda en milímetros.' })
    .int('El ancho va en milímetros enteros.')
    .min(100, 'El ancho de banda va entre 100 y 400 mm.')
    .max(400, 'El ancho de banda va entre 100 y 400 mm.'),
  profundidadMm: z.coerce
    .number({ error: 'Escribe la profundidad en milímetros.' })
    .positive('La profundidad debe ser mayor que cero.')
    .max(30, 'La profundidad va hasta 30 mm.')
    .refine((v) => Number.isInteger(v * 10), { error: 'La profundidad admite un decimal (por ejemplo, 16.5).' }),
  // Sin repetidas: la lista se limpia antes de guardarla
  medidas: z
    .array(medida, { error: 'Agrega las medidas de llanta compatibles.' })
    .min(1, 'Agrega al menos una medida de llanta compatible.')
    .max(20, 'Una banda admite hasta 20 medidas.')
    .transform((lista) => [...new Set(lista)]),
  precio: pesosPositivos('El precio de la banda debe ser mayor que cero.'),
};

/** POST /bandas */
export const esquemaBanda = z.object({ ...camposBanda, activo: z.boolean().optional() });

/** PUT /bandas/:id — todo opcional, el código no se cambia. */
export const esquemaCambioBanda = objetoEstricto(
  { ...camposBanda, activo: z.boolean() },
  'Este campo no se puede modificar en la banda.',
).partial();

// ---- Solicitud ----------------------------------------------------------------

const camposSolicitud = {
  bandaId: idRelacion,
  medida,
  cantidad: llantas,
  lugar: z.enum(['Local', 'Cliente'], { error: 'Elige dónde revisamos las llantas.' }),
  direccion: textoOpcional(200),
  fechaPreferida: fechaRevision,
  notas: textoOpcional(500),
};

const conDireccion = (datos, ctx) => {
  if (datos.lugar === 'Cliente' && !datos.direccion) {
    ctx.addIssue({ code: 'custom', path: ['direccion'], message: 'Escribe la dirección donde revisamos las llantas.' });
  }
};

/** POST /portal/reencauches — lo pide el cliente desde el portal. */
export const esquemaSolicitudPortal = z.object(camposSolicitud).superRefine(conDireccion);

/** POST /reencauches — lo registra el asesor para un cliente. */
export const esquemaSolicitudPersonal = z
  .object({ clienteId: idRelacion, ...camposSolicitud })
  .superRefine(conDireccion);

/** GET /reencauches */
export const esquemaListadoReencauches = listadoCon(['estado']);

/** POST /reencauches/:numero/agenda */
export const esquemaAgenda = z.object({ fechaRevision });

/** POST /reencauches/:numero/cancelar (el asesor siempre da el motivo) */
export const esquemaCancelacion = z.object({ motivo: texto(300) });

/** POST /portal/reencauches/:numero/cancelar (el cliente puede no darlo) */
export const esquemaCancelacionCliente = z.object({ motivo: textoOpcional(300) });

/** POST /reencauches/:numero/respuesta y /portal/reencauches/:numero/respuesta */
export const esquemaRespuesta = z.object({ acepta: z.boolean({ error: 'Indica si se acepta la cotización.' }) });

// ---- Revisión de cada llanta ----------------------------------------------------

const llantaRevisada = z
  .object({
    dot: z
      .string({ error: 'Escribe el DOT de la llanta.' })
      .trim()
      .regex(/^\d{4}$/, 'El DOT son los 4 dígitos de semana y año (por ejemplo, 2321).'),
    medida,
    reencauchesPrevios: z.coerce.number().int().min(0, 'No puede ser negativo.').max(9, 'Máximo 9 reencauches previos.').default(0),
    resultado: z.enum(['Apta', 'No apta'], { error: 'Indica si la llanta es apta.' }),
    motivoNoApta: textoOpcional(300),
    bandaId: idRelacion.optional(),
    precioBanda: pesosPositivos('El precio de la banda debe ser mayor que cero.').optional(),
    manoObra: pesosPositivos('La mano de obra debe ser mayor que cero.').optional(),
  })
  .superRefine((l, ctx) => {
    if (l.resultado === 'No apta' && !l.motivoNoApta) {
      ctx.addIssue({ code: 'custom', path: ['motivoNoApta'], message: 'Escribe por qué la llanta no es apta.' });
    }
    if (l.resultado === 'Apta' && !l.bandaId) {
      ctx.addIssue({ code: 'custom', path: ['bandaId'], message: 'Elige la banda para la llanta.' });
    }
    if (l.resultado === 'Apta' && !l.manoObra) {
      ctx.addIssue({ code: 'custom', path: ['manoObra'], message: 'Escribe el valor de la mano de obra.' });
    }
  });

/** POST /reencauches/:numero/revision */
export const esquemaRevision = z.object({
  llantas: z
    .array(llantaRevisada, { error: 'Registra las llantas revisadas.' })
    .min(1, 'Registra al menos una llanta.')
    .max(LLANTAS_POR_REENCAUCHE, `Cada solicitud admite hasta ${LLANTAS_POR_REENCAUCHE} llantas.`),
});

// ---- Órdenes en la reencauchadora ---------------------------------------------------

/** GET /reencauches/ordenes */
export const esquemaListadoOrdenes = listadoCon(['estado']);

/** POST /reencauches/ordenes/:id/envio */
export const esquemaEnvio = z.object({ terceroId: idRelacion });

/** POST /reencauches/ordenes/:id/rechazo */
export const esquemaRechazoPlanta = z.object({ motivo: texto(300) });

/** POST /reencauches/ordenes/:id/entrega — se cobra al entregar. */
export const esquemaEntrega = z.object({ medioPago });
