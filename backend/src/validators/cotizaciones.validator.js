import { z } from 'zod';
import { ESTADOS_EVIDENCIA, estadosDe } from '../reglas.js';
import {
  cantidad,
  idRelacion,
  imagen,
  listadoCon,
  medioPago,
  metodoPago,
  objetoEstricto,
  pesos,
  pesosPositivos,
  texto,
  textoExplicado,
  textoExplicadoOpcional,
  textoOpcional,
} from './comunes.validator.js';

/** POST /portal/cotizaciones/:numero/cancelar — el motivo es obligatorio. */
export const esquemaCancelacionCliente = z.object({
  motivo: textoExplicado(80),
});

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
  descripcion: textoExplicado(80),
  // Hasta 3 fotos de la llanta (`foto` sola se sigue aceptando)
  foto: imagen.optional(),
  fotos: z.array(imagen).max(3, 'Puedes adjuntar máximo 3 fotos.').optional(),
  // Solo el asesor califica la carcasa; al cliente siempre le queda pendiente
  estadoEvidencia: z.enum(ESTADOS_EVIDENCIA).optional(),
}).refine((l) => l.foto || l.fotos?.length, { error: 'Adjunta al menos una foto de la llanta.', path: ['fotos'] });

/**
 * POST /cotizaciones (asesor o cliente del portal): la solicitud. Solo
 * productos, cantidades y servicios: no lleva precios, fecha (la pone el
 * servidor) ni método de pago (se elige al aceptar la cotización formal).
 */
export const esquemaNueva = z.object({
  // El asesor elige el cliente; para el portal es el cliente en sesión
  clienteId: idRelacion.optional(),
  proveedorId: idRelacion.nullable().optional(),
  direccionEntrega: texto(80),
  lineas: z
    .array(z.discriminatedUnion('tipo', [lineaProducto, lineaServicio]))
    .min(1, 'Agrega al menos un producto o servicio.'),
});

/**
 * POST /cotizaciones/:numero/emitir — por cada llanta: el proveedor con el
 * que se verificó el precio, su precio de compra y el de venta definitivo.
 */
export const esquemaEmision = z.object({
  lineas: z
    .array(
      z.object({
        id: idRelacion,
        proveedorId: idRelacion,
        // Lo que cobra el proveedor (precio de compra) y lo que paga el cliente
        costoProveedor: pesosPositivos('Indica el precio de compra.'),
        precioUnitario: pesosPositivos('Indica el precio de venta.'),
      })
      // Regla de negocio: nunca se vende por debajo de lo que se compra
      .refine((l) => l.precioUnitario >= l.costoProveedor, {
        error: 'El precio de venta no puede ser menor que el precio de compra.',
        path: ['precioUnitario'],
      }),
    )
    .min(1, 'Confirma el precio de al menos una llanta.'),
});

/** Pago con su medio y, salvo en efectivo, la consignación. */
const pagoConComprobante = z.object({
  medioPago,
  comprobante: imagen.optional(),
});

/**
 * POST /cotizaciones/:numero/aceptar (y /portal/…): contado con su pago, o
 * crédito con plazo y cuota inicial.
 */
export const esquemaAceptacion = z.object({
  metodoPago,
  plazoDias: z.coerce.number().int().optional(),
  pago: pagoConComprobante.optional(),
  // (la cuota inicial del crédito ya no se paga al aceptar: se ignora si llega)
  cuotaInicial: z.unknown().optional(),
});

/** PATCH /cotizaciones/:numero (solo personal). */
export const esquemaCambio = objetoEstricto(
  {
    estado: z.enum(estadosDe('cotizacion')).optional(),
    estadoEntrega: z.enum(estadosDe('entrega')).optional(),
    motivoCancelacion: textoExplicadoOpcional(80),
    proveedorId: idRelacion.nullable().optional(),
    direccionEntrega: texto(80).optional(),
  },
  'Este campo no se puede modificar en una cotización.',
);

/** POST /cotizaciones/:numero/pago — el asesor aprueba o rechaza la consignación. */
export const esquemaRevisionPago = z.object({
  estado: z.enum(['Aprobado', 'Rechazado'], { error: 'Indica si apruebas o rechazas el pago.' }),
  motivo: textoExplicadoOpcional(80),
});

/** POST /portal/cotizaciones/:numero/pago — el cliente vuelve a subir el pago rechazado. */
export const esquemaPagoCliente = z.object({
  medioPago,
  comprobante: imagen.optional(),
});
