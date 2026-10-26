import { z } from 'zod';
import { estadosDe } from '../reglas.js';
import { cantidad, idRelacion, listadoCon, objetoEstricto, pesos } from './comunes.validator.js';

/** GET /compras */
export const esquemaListado = listadoCon(['estado', 'estadoEntrega', 'proveedorId']);

/** POST /compras */
export const esquemaNueva = z.object({
  // Número de la cotización de origen (PED-2024-002…)
  cotizacion: z.string().trim().min(1).max(30).nullable().optional(),
  lineas: z
    .array(
      z.object({
        productoId: idRelacion,
        cantidad: cantidad(9999),
        precioUnitario: pesos,
        origen: z.enum(['Cotización', 'Adicional']).default('Adicional'),
      }),
    )
    .min(1, 'Agrega al menos un producto a la compra.'),
});

/** PATCH /compras/:numero */
export const esquemaCambio = objetoEstricto(
  {
    estado: z.enum(estadosDe('compra')).optional(),
    estadoEntrega: z.enum(estadosDe('entrega')).optional(),
  },
  'Este campo no se puede modificar en una compra.',
);
