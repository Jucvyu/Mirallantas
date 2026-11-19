import { z } from 'zod';
import { estadosDe } from '../reglas.js';
import {
  cantidad,
  idRelacion,
  imagen,
  listadoCon,
  medioPago,
  metodoPago,
  objetoEstricto,
  pesosPositivos,
  hoyNegocio,
  telefono,
  texto,
  textoExplicado,
  textoExplicadoOpcional,
  textoOpcional,
} from './comunes.validator.js';

/** Cómo recibe el cliente el pedido: se le despacha o lo recoge en el local. */
export const MODOS_ENTREGA = ['Despacho', 'Recoge'];

/** Días desde hoy (zona del negocio) hasta una fecha AAAA-MM-DD. */
const diasHasta = (valor) => (Date.parse(`${valor}T00:00:00Z`) - Date.parse(`${hoyNegocio()}T00:00:00Z`)) / 86_400_000;

/** Para cuándo necesita el cliente las llantas: de hoy en adelante, hasta 6 meses. */
const fechaRequerida = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.')
  .refine((v) => diasHasta(v) >= 0, { error: 'La fecha no puede ser anterior a hoy.' })
  .refine((v) => diasHasta(v) <= 183, { error: 'Elige una fecha dentro de los próximos 6 meses.' });

/** Vacío o null → null (campos opcionales que llegan de un formulario). */
const opcional = (esquema) => z.preprocess((v) => (v === '' ? null : v), esquema.nullable()).optional();

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

/**
 * Línea de la solicitud: solo llantas. Una línea de servicio se rechaza con
 * un mensaje claro (antes el reencauche entraba aquí; ahora tiene su módulo).
 */
const lineaSoloLlanta = z.unknown().superRefine((linea, ctx) => {
  if (linea && typeof linea === 'object' && linea.tipo === 'servicio') {
    ctx.addIssue({
      code: 'custom',
      message: 'La cotización es solo de llantas: el reencauche se pide aparte, en "Reencauche".',
    });
  }
}).pipe(lineaProducto);

/**
 * POST /cotizaciones (asesor o cliente del portal): la solicitud. Solo
 * productos, cantidades y servicios: no lleva precios, fecha (la pone el
 * servidor) ni método de pago (se elige al aceptar la cotización formal).
 */
export const esquemaNueva = z.object({
  // El asesor elige el cliente; para el portal es el cliente en sesión
  clienteId: idRelacion.optional(),
  proveedorId: idRelacion.nullable().optional(),
  // Despacho a una dirección (la de siempre) o recoge en el local (sin dirección)
  modoEntrega: z.enum(MODOS_ENTREGA, { error: 'Elige si te lo despachamos o lo recoges.' }).default('Despacho'),
  direccionEntrega: textoOpcional(80),
  telefonoContacto: opcional(telefono),
  fechaRequerida: opcional(fechaRequerida),
  observaciones: textoOpcional(300),
  lineas: z
    // Solo llantas: el reencauche ya no va en la cotización, se pide en
    // Reencauche (revisión gratis y órdenes por llanta)
    .array(lineaSoloLlanta, { error: 'Agrega al menos una llanta.' })
    .min(1, 'Agrega al menos una llanta.'),
}).superRefine((d, ctx) => {
  if (d.modoEntrega === 'Despacho' && !d.direccionEntrega) {
    ctx.addIssue({ code: 'custom', path: ['direccionEntrega'], message: 'Escribe a dónde te despachamos el pedido.' });
  }
});

/** Un proveedor dentro del reparto de una llanta: su cantidad y su precio de compra. */
const proveedorDeReparto = z.object({
  proveedorId: idRelacion,
  cantidad: cantidad(),
  costo: pesosPositivos('Indica el precio de compra.'),
});

/**
 * POST /cotizaciones/:numero/emitir — por cada llanta: el precio de venta y,
 * para la compra, uno o varios proveedores. Con un solo proveedor se envían
 * `proveedorId` y `costoProveedor`; con varios, el reparto en `proveedores`
 * (cada uno con su cantidad y su precio de compra). El precio de venta es
 * uno solo por llanta.
 */
export const esquemaEmision = z.object({
  lineas: z
    .array(
      z
        .object({
          id: idRelacion,
          precioUnitario: pesosPositivos('Indica el precio de venta.'),
          proveedorId: idRelacion.optional(),
          costoProveedor: pesosPositivos('Indica el precio de compra.').optional(),
          proveedores: z.array(proveedorDeReparto).min(1).optional(),
        })
        // Debe venir el reparto (varios) o el proveedor y su costo (uno)
        .refine((l) => Boolean(l.proveedores?.length) || (l.proveedorId != null && l.costoProveedor != null), {
          error: 'Indica el proveedor y el precio de compra.',
          path: ['proveedorId'],
        })
        // Regla de negocio: nunca se vende por debajo de lo que se compra
        .refine(
          (l) =>
            (l.proveedores?.length ? l.proveedores.map((p) => p.costo) : [l.costoProveedor]).every(
              (c) => c == null || l.precioUnitario >= c,
            ),
          { error: 'El precio de venta no puede ser menor que el precio de compra.', path: ['precioUnitario'] },
        ),
    ),
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
