import { z } from 'zod';
import { estadosDe, PLAZOS_CREDITO } from '../reglas.js';
import {
  idRelacion,
  imagen,
  listadoCon,
  medioPago,
  objetoEstricto,
  pesosPositivos,
  textoExplicadoOpcional,
  textoOpcional,
} from './comunes.validator.js';

/** Plazo del crédito: solo los que maneja la empresa (30, 60 o 90 días). */
const plazo = z.coerce
  .number()
  .int()
  .refine((p) => PLAZOS_CREDITO.includes(p), { error: `El plazo debe ser de ${PLAZOS_CREDITO.join(', ')} días.` });

// ---- Créditos -----------------------------------------------------------------

export const esquemaListadoCreditos = listadoCon(['clienteId']);

/** POST /creditos — financia una cotización completada. */
export const esquemaCredito = z.object({
  cotizacion: z.string().trim().min(1, 'Selecciona la cotización que se va a financiar.').max(30),
  montoTotal: pesosPositivos('Indica el monto del crédito.'),
  plazoDias: plazo,
});

/** PATCH /creditos/:numero */
export const esquemaActivoCredito = z.strictObject({ activo: z.boolean() });

// ---- Abonos -------------------------------------------------------------------

export const esquemaListadoAbonos = listadoCon(['estado', 'medioPago', 'credito']);

/** GET /abonos/facturas */
export const esquemaFacturas = z.object({ clienteId: idRelacion.optional() });

/** POST /abonos — abono del asesor sobre una factura (venta a crédito). */
export const esquemaAbonoFactura = z.object({
  factura: z.string().trim().regex(/^VEN-\d{4}-\d{3,}$/, 'Selecciona una factura de la lista.'),
  monto: pesosPositivos('Indica el monto pagado.'),
  medioPago,
  comprobante: imagen.nullable().optional(),
});

/** POST /creditos/:numero/abonos */
export const esquemaAbono = z.object({
  monto: pesosPositivos('Indica el monto pagado.'),
  medioPago,
  comprobante: imagen.nullable().optional(),
});

/** PATCH /abonos/:numero — confirmar, rechazar o corregir uno pendiente. */
export const esquemaCambioAbono = objetoEstricto(
  {
    estado: z.enum(estadosDe('abono')).optional(),
    // Mientras está pendiente se puede corregir lo que se digitó
    monto: pesosPositivos('El monto debe ser mayor que cero.').optional(),
    medioPago: medioPago.optional(),
    // Por qué se rechaza: el cliente lo ve y vuelve a subir el abono
    motivo: textoExplicadoOpcional(80),
  },
  'Este campo no se puede modificar en un abono.',
);

// ---- Solicitudes de crédito -----------------------------------------------------

export const esquemaListadoSolicitudes = listadoCon(['estado']);

/** POST /solicitudes-credito */
export const esquemaSolicitud = z.object({
  clienteId: idRelacion.optional(),
  monto: pesosPositivos('Indica el monto que necesitas.'),
  plazoDias: plazo,
});

/** PATCH /solicitudes-credito/:numero — el asesor aprueba o rechaza. */
export const esquemaRevision = z.strictObject({
  estado: z.enum(estadosDe('solicitudCredito')),
  motivo: textoExplicadoOpcional(80),
});
