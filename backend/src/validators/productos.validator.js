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
  // Sin espacios y en mayúsculas: "195/65 r15" y "195/65R15" son la misma medida
  medidas: texto(30).transform((v) => v.replace(/\s+/g, '').toUpperCase()),
  tipoVehiculoId: idRelacion.nullable().optional(),
  precioVenta: pesos,
  // Foto principal; null la quita
  foto: imagen.nullable().optional(),
};

/**
 * POST /productos. No acepta código (lo genera el servidor) ni precio de
 * compra (pertenece a cada compra).
 */
export const esquemaNuevo = objetoEstricto(campos, 'Este campo no se registra en el producto.');

/**
 * PUT /productos/:id. No acepta `codigo` (no cambia una vez asignado) ni
 * `precioCompra`.
 */
export const esquemaEdicion = objetoEstricto(
  { ...campos, activo: z.boolean() },
  'Este campo no se puede modificar desde el producto.',
).partial();
