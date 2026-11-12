import { z } from 'zod';
import {
  esquemaListado,
  idRelacion,
  imagen,
  nombreEntidad,
  objetoEstricto,
  pesosPositivos,
  texto,
  textoExplicadoOpcional,
  textoOpcional,
} from './comunes.validator.js';

/** GET /productos — además de la búsqueda, filtros por catálogo y por modelo. */
export const esquemaFiltros = esquemaListado.extend({
  categoriaId: z.coerce.number().int().positive().optional(),
  marcaId: z.coerce.number().int().positive().optional(),
  tipoVehiculoId: z.coerce.number().int().positive().optional(),
  modeloId: z.coerce.number().int().positive().optional(),
  // Un solo producto (p. ej. la página de una llanta reencauchada, que es única)
  id: z.coerce.number().int().positive().optional(),
});

// ---- Campos de una referencia (una medida de un modelo) ----------------------

/** Sin espacios y en mayúsculas: "195/65 r15" y "195/65R15" son la misma medida. */
export const medidas = texto(30).transform((v) => v.replace(/\s+/g, '').toUpperCase());

/** Número opcional: vacío o null se guarda como null. */
const numeroOpcional = (esquema) => z.preprocess((v) => (v === '' ? null : v), esquema.nullable()).optional();

/**
 * Datos propios de cada referencia. El índice de velocidad no se maneja.
 *   posicion           Direccional, Tracción o Cualquier posición
 *   indiceCarga        152/148 (sencilla/doble) o 91
 *   lonas              número de lonas (PR)
 *   profundidadLabrado en milímetros, con un decimal
 *   pesoKg             peso de la llanta en kilos
 *   codigoFabricante   código o SKU del fabricante
 */
export const POSICIONES = ['Direccional', 'Tracción', 'Cualquier posición'];

export const camposReferencia = {
  medidas,
  // Posición de la llanta: el cliente la elige junto con la medida
  posicion: z
    .enum(POSICIONES, { error: 'La posición es Direccional, Tracción o Cualquier posición.' })
    .nullable()
    .optional(),
  indiceCarga: textoOpcional(7).refine((v) => v == null || /^[0-9]{2,3}(\/[0-9]{2,3})?$/.test(v), {
    error: 'El índice de carga son 2 o 3 dígitos, o dos separados por "/" (p. ej. 152/148).',
  }),
  lonas: numeroOpcional(
    z.coerce.number().int('Las lonas son un número entero.').min(1, 'Mínimo 1 lona.').max(40, 'Máximo 40 lonas.'),
  ),
  profundidadLabrado: numeroOpcional(
    z.coerce
      .number()
      .positive('La profundidad del labrado debe ser mayor que cero.')
      .max(50, 'La profundidad del labrado es de máximo 50 mm.')
      .refine((v) => Math.abs(Math.round(v * 10) - v * 10) < 1e-9, { error: 'Usa máximo un decimal (p. ej. 16.5).' }),
  ),
  pesoKg: numeroOpcional(
    z.coerce
      .number()
      .positive('El peso debe ser mayor que cero.')
      .max(2000, 'El peso es de máximo 2000 kg.')
      .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-9, { error: 'Usa máximo dos decimales.' }),
  ),
  codigoFabricante: textoOpcional(40),
};

const campos = {
  // Del modelo: al editarlos cambia el modelo y todas sus referencias
  nombre: nombreEntidad(80),
  descripcion: textoExplicadoOpcional(200),
  categoriaId: idRelacion,
  marcaId: idRelacion,
  tipoVehiculoId: idRelacion.nullable().optional(),
  // De la referencia
  ...camposReferencia,
  // Foto propia de la referencia; null la quita
  foto: imagen.nullable().optional(),
};

/**
 * POST /productos. No acepta código (lo genera el servidor) ni precios: el
 * de venta se define en cada cotización y el de compra en cada compra.
 * Con `modeloId` agrega una medida a ese modelo (los datos del modelo no
 * hacen falta); sin él, la base busca o crea el modelo por marca + nombre.
 */
export const esquemaNuevo = objetoEstricto(
  { ...campos, modeloId: idRelacion.optional() },
  'Este campo no se registra en el producto.',
)
  .partial({ nombre: true, categoriaId: true, marcaId: true })
  .superRefine((d, ctx) => {
    if (d.modeloId) return;
    for (const campo of ['nombre', 'categoriaId', 'marcaId']) {
      if (d[campo] === undefined) ctx.addIssue({ code: 'custom', path: [campo], message: 'Este campo es obligatorio.' });
    }
  });

/**
 * PUT /productos/:id. No acepta `codigo` (no cambia una vez asignado) ni
 * precios.
 */
export const esquemaEdicion = objetoEstricto(
  // precioVenta: solo para la llanta reencauchada (precio fijo; el controlador lo revisa)
  { ...campos, activo: z.boolean(), precioVenta: pesosPositivos('El precio de venta debe ser mayor que cero.') },
  'Este campo no se puede modificar desde el producto.',
).partial();
