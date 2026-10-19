import { z } from 'zod';
import { ESTADOS_EVIDENCIA, estadosDe } from '../reglas.js';
import {
  cantidad,
  fecha,
  idRelacion,
  imagen,
  listadoCon,
  medioPago,
  metodoPago,
  objetoEstricto,
  pesos,
  texto,
  textoOpcional,
} from './comunes.validator.js';

/** GET /cotizaciones */
export const esquemaListado = listadoCon(['estado', 'estadoEntrega', 'metodoPago', 'clienteId']);

const lineaProducto = z.object({
  tipo: z.literal('producto'),
  productoId: idRelacion,
  cantidad: cantidad(),
});

const lineaServicio = z.object({
  tipo: z.literal('servicio'),
  // Si no se indica, se usa el servicio por defecto (reencauche en frío)
  servicioId: idRelacion.optional(),
  cantidad: cantidad(),
  medidas: textoOpcional(30),
  descripcion: texto(500),
  foto: imagen,
  // Solo el asesor califica la carcasa; al cliente siempre le queda pendiente
  estadoEvidencia: z.enum(ESTADOS_EVIDENCIA).optional(),
});

/** POST /cotizaciones (asesor o cliente del portal). */
export const esquemaNueva = z.object({
  // El asesor elige el cliente; para el portal es el cliente en sesión
  clienteId: idRelacion.optional(),
  proveedorId: idRelacion.nullable().optional(),
  fecha: fecha.optional(),
  metodoPago,
  plazoDias: z.coerce.number().int().optional(),
  direccionEntrega: texto(200),
  lineas: z
    .array(z.discriminatedUnion('tipo', [lineaProducto, lineaServicio]))
    .min(1, 'Agrega al menos un producto o servicio.'),
  // Pago de contado: con qué paga y la consignación (salvo en efectivo)
  pago: z
    .object({
      medioPago,
      comprobante: imagen.optional(),
    })
    .optional(),
  // Pago de la cuota inicial (solo a crédito)
  cuotaInicial: z
    .object({
      monto: pesos,
      medioPago: medioPago.optional(),
      comprobante: imagen.optional(),
    })
    .optional(),
});

/** PATCH /cotizaciones/:numero (solo personal). */
export const esquemaCambio = objetoEstricto(
  {
    estado: z.enum(estadosDe('cotizacion')).optional(),
    estadoEntrega: z.enum(estadosDe('entrega')).optional(),
    motivoCancelacion: textoOpcional(500),
    proveedorId: idRelacion.nullable().optional(),
    direccionEntrega: texto(200).optional(),
  },
  'Este campo no se puede modificar en una cotización.',
);

/** POST /cotizaciones/:numero/pago — el asesor aprueba o rechaza la consignación. */
export const esquemaRevisionPago = z.object({
  estado: z.enum(['Aprobado', 'Rechazado'], { error: 'Indica si apruebas o rechazas el pago.' }),
  motivo: textoOpcional(300),
});

/** POST /portal/cotizaciones/:numero/pago — el cliente vuelve a subir el pago rechazado. */
export const esquemaPagoCliente = z.object({
  medioPago,
  comprobante: imagen.optional(),
});
