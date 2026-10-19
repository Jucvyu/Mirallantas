import { z } from 'zod';
import { estadosDe } from '../reglas.js';
import {
  fecha,
  idRelacion,
  imagen,
  listadoCon,
  metodoPago,
  objetoEstricto,
  pesos,
  pesosPositivos,
} from './comunes.validator.js';

/** GET /ventas */
export const esquemaListado = listadoCon(['estado', 'estadoEntrega', 'metodoPago', 'clienteId']);

/** POST /ventas — venta directa (sin cotización). */
export const esquemaNueva = z.object({
  clienteId: idRelacion,
  proveedorId: idRelacion.nullable().optional(),
  terceroId: idRelacion.nullable().optional(),
  fecha,
  metodoPago,
  total: pesosPositivos('Indica el valor total de la venta.'),
  interes: pesos.optional(),
  cuotaInicial: pesos.optional(),
  comprobante: imagen.nullable().optional(),
});

/** PATCH /ventas/:numero */
export const esquemaCambio = objetoEstricto(
  {
    estado: z.enum(estadosDe('venta')).optional(),
    estadoEntrega: z.enum(estadosDe('entrega')).optional(),
    proveedorId: idRelacion.nullable().optional(),
    terceroId: idRelacion.nullable().optional(),
    comprobante: imagen.nullable().optional(),
  },
  'Este campo no se puede modificar en una venta.',
);
