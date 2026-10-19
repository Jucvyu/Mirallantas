import { z } from 'zod';
import {
  esquemaListado,
  idRelacion,
  imagen,
  objetoEstricto,
  pesos,
  texto,
  textoOpcional,
} from './comunes.validator.js';

/** GET /productos — además de la búsqueda, filtros por catálogo. */
export const esquemaFiltros = esquemaListado.extend({
  categoriaId: z.coerce.number().int().positive().optional(),
  marcaId: z.coerce.number().int().positive().optional(),
  tipoVehiculoId: z.coerce.number().int().positive().optional(),
});

const campos = {
  nombre: texto(150),
  descripcion: textoOpcional(500),
  categoriaId: idRelacion,
  marcaId: idRelacion,
  medidas: texto(30),
  tipoVehiculoId: idRelacion.nullable().optional(),
  precioVenta: pesos,
  // Foto principal; null la quita
  foto: imagen.nullable().optional(),
};

/**
 * POST /productos. No acepta precio de compra ni stock: el precio de compra
 * pertenece a cada compra y el stock de un producto nuevo arranca en cero.
 */
export const esquemaNuevo = objetoEstricto(
  {
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,30}$/, 'El código solo admite letras, números y guiones (3 a 30 caracteres).'),
    ...campos,
  },
  'Este campo no se registra en el producto.',
);

/**
 * PUT /productos/:id. No acepta `codigo` (no cambia una vez asignado),
 * `precioCompra` ni `stock`.
 */
export const esquemaEdicion = objetoEstricto(
  { ...campos, activo: z.boolean() },
  'Este campo no se puede modificar desde el producto.',
).partial();
