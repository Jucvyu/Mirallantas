import { z } from 'zod';
import {
  archivoPdf,
  esquemaListado,
  idRelacion,
  imagen,
  nombreEntidad,
  objetoEstricto,
  textoExplicadoOpcional,
  textoOpcional,
} from './comunes.validator.js';
import { camposReferencia } from './productos.validator.js';

/**
 * Validación de los modelos de llanta (/api/modelos) y de sus referencias
 * (las medidas que se venden).
 */

/** GET /modelos — búsqueda, estado y filtros por catálogo. */
export const esquemaFiltros = esquemaListado.extend({
  categoriaId: z.coerce.number().int().positive().optional(),
  marcaId: z.coerce.number().int().positive().optional(),
  tipoVehiculoId: z.coerce.number().int().positive().optional(),
});

/** :id del modelo y :referenciaId de una de sus medidas. */
export const esquemaIdReferencia = z.object({
  id: z.coerce.number().int().positive('El id no es válido.'),
  referenciaId: z.coerce.number().int().positive('El id no es válido.'),
});

export const CONSTRUCCIONES = ['Radial', 'Diagonal'];

/** Sí / No / sin dato (null). */
const siNo = z.boolean({ error: 'Elige Sí o No.' }).nullable().optional();

/** Ficha técnica: todo opcional, se copia a mano de la página del fabricante. */
const camposFicha = {
  uso: textoOpcional(80),
  labrado: textoOpcional(60),
  construccion: z.enum(CONSTRUCCIONES, { error: 'La construcción es Radial o Diagonal.' }).nullable().optional(),
  sinCamara: siNo,
  garantiaMeses: z
    .preprocess(
      (v) => (v === '' ? null : v),
      z.coerce
        .number()
        .int('La garantía va en meses enteros.')
        .min(0, 'La garantía no puede ser negativa.')
        .max(240, 'La garantía es de máximo 240 meses.')
        .nullable(),
    )
    .optional(),
  paisOrigen: textoOpcional(60),
  recauchable: siNo,
  // Página de donde se copió la ficha (fabricante o proveedor)
  fuenteFicha: textoOpcional(300),
  // PDF de la ficha técnica del fabricante; null lo quita
  fichaPdf: archivoPdf.nullable().optional(),
};

const camposModelo = {
  nombre: nombreEntidad(80),
  descripcion: textoExplicadoOpcional(200),
  categoriaId: idRelacion,
  marcaId: idRelacion,
  tipoVehiculoId: idRelacion.nullable().optional(),
  ...camposFicha,
  // Foto principal del modelo; null la quita
  foto: imagen.nullable().optional(),
};

/** Una medida nueva de un modelo. */
export const esquemaReferencia = objetoEstricto(camposReferencia, 'Este campo no se registra en la medida.');

/** Editar una medida: también la activa o desactiva. */
export const esquemaEdicionReferencia = objetoEstricto(
  { ...camposReferencia, activo: z.boolean({ error: 'Envía "activo" como true o false.' }) },
  'Este campo no se puede modificar en la medida.',
).partial();

/** POST /modelos — el modelo con su ficha, su foto y (opcional) sus primeras medidas. */
export const esquemaNuevo = objetoEstricto(
  {
    ...camposModelo,
    referencias: z.array(esquemaReferencia).max(50, 'Máximo 50 medidas a la vez.').optional(),
  },
  'Este campo no se registra en el producto.',
);

/** PUT /modelos/:id — cualquier campo del modelo; también lo activa o desactiva. */
export const esquemaEdicion = objetoEstricto(
  { ...camposModelo, activo: z.boolean({ error: 'Envía "activo" como true o false.' }) },
  'Este campo no se puede modificar en el producto.',
).partial();
