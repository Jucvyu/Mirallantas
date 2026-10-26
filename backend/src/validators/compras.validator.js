import { z } from 'zod';
import { estadosDe } from '../reglas.js';
import { cantidad, idRelacion, listadoCon, objetoEstricto, pesos } from './comunes.validator.js';

/** GET /compras */
export const esquemaListado = listadoCon(['estado', 'estadoEntrega', 'proveedorId']);

/** Líneas de una compra (al crearla o al editar su detalle). */
const lineasCompra = z
  .array(
    z
      .object({
        productoId: idRelacion,
        cantidad: cantidad(9999),
        precioUnitario: pesos,
        origen: z.enum(['Cotización', 'Adicional']).default('Adicional'),
        // Proveedor de un producto adicional (las de la cotización ya lo traen)
        proveedorId: idRelacion.nullable().optional(),
      })
      // Un producto que no estaba en la cotización exige su proveedor y su precio
      .superRefine((l, ctx) => {
        if (l.origen !== 'Adicional') return;
        if (!l.proveedorId) ctx.addIssue({ code: 'custom', path: ['proveedorId'], message: 'Elige el proveedor del producto adicional.' });
        if (!(l.precioUnitario > 0)) {
          ctx.addIssue({ code: 'custom', path: ['precioUnitario'], message: 'Indica el precio de compra del producto adicional.' });
        }
      }),
  )
  .min(1, 'Agrega al menos un producto a la compra.');

/** POST /compras */
export const esquemaNueva = z.object({
  // Número de la cotización de origen (PED-2024-002…)
  cotizacion: z.string().trim().min(1).max(30).nullable().optional(),
  lineas: lineasCompra,
});

/** PATCH /compras/:numero */
export const esquemaCambio = objetoEstricto(
  {
    estado: z.enum(estadosDe('compra')).optional(),
    estadoEntrega: z.enum(estadosDe('entrega')).optional(),
    // Nuevo detalle: solo mientras la compra y su entrega estén pendientes
    lineas: lineasCompra.optional(),
  },
  'Este campo no se puede modificar en una compra.',
);
