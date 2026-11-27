import { z } from 'zod';
import {
  correo,
  documentoSegunTipo,
  nombreEntidad,
  nombrePersona,
  numeroDocumento,
  pesos,
  telefono,
  texto,
  textoExplicadoOpcional,
  textoOpcional,
  tipoDocumento,
} from './comunes.validator.js';

/**
 * Esquemas de los catálogos. Son los de crear; al editar se usa su versión
 * `.partial()` (todos los campos opcionales).
 */

const activo = { activo: z.boolean().optional() };

const contactoOpcional = {
  telefono: telefono.nullable().optional(),
  correo: correo.nullable().optional(),
  direccion: textoOpcional(80),
};

/** Cuerpo de PATCH /:id/estado */
export const esquemaEstado = z.object({ activo: z.boolean({ error: 'Envía "activo" como true o false.' }) });

/**
 * Datos del producto que una categoría puede marcar como "no aplica" (p. ej.
 * una llanta de moto no lleva lonas ni posición). Ver migración 0042.
 */
export const CAMPOS_OCULTABLES = [
  'uso', 'labrado', 'construccion', 'sinCamara', 'recauchable', 'garantiaMeses', 'paisOrigen',
  'posicion', 'indiceCarga', 'lonas', 'profundidadLabrado', 'pesoKg', 'codigoFabricante',
];

export const esquemaCategoria = z.object({
  nombre: nombreEntidad(80),
  descripcion: textoExplicadoOpcional(80),
  camposOcultos: z
    .array(z.enum(CAMPOS_OCULTABLES, { error: 'Uno de los datos marcados no existe.' }))
    .max(CAMPOS_OCULTABLES.length)
    .transform((lista) => [...new Set(lista)])
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener la forma #RRGGBB.')
    .optional(),
  ...activo,
});

export const esquemaMarca = z.object({ nombre: nombreEntidad(80), ...activo });

export const esquemaTipoVehiculo = z.object({ nombre: nombreEntidad(80) });

export const esquemaServicio = z.object({
  nombre: nombreEntidad(80),
  descripcion: textoExplicadoOpcional(80),
  precio: pesos,
  garantiaDias: z.coerce.number().int().min(0).max(3650).optional(),
  ...activo,
});

export const esquemaCliente = z.object({
  tipoDocumento,
  numeroDocumento,
  nombreCompleto: nombrePersona(80),
  ...contactoOpcional,
  ...activo,
});

/**
 * Proveedores y terceros (reencauchadoras): persona natural o jurídica
 * (migraciones 0044 y 0046). La jurídica se identifica con NIT y lleva
 * persona de contacto. Los dos usan el mismo formulario.
 */
export const esquemaProveedor = z.object({
  // Sin indicarlo queda como persona natural (valor por defecto en la base)
  tipoPersona: z.enum(['Natural', 'Jurídica'], { error: 'Indica si es persona natural o jurídica.' }).optional(),
  tipoDocumento,
  numeroDocumento,
  nombreRazonSocial: nombreEntidad(80),
  contacto: textoOpcional(80),
  ...contactoOpcional,
  ...activo,
});

/** Reglas de la persona jurídica (si llegan los datos: al editar, puede no llegar todo). */
export function reglasTipoPersona(datos, ctx) {
  if (datos.tipoPersona !== 'Jurídica') return;
  if (datos.tipoDocumento && datos.tipoDocumento !== 'NIT') {
    ctx.addIssue({ code: 'custom', path: ['tipoDocumento'], message: 'La persona jurídica se identifica con NIT.' });
  }
  if ('contacto' in datos && !datos.contacto) {
    ctx.addIssue({ code: 'custom', path: ['contacto'], message: 'Escribe la persona de contacto de la empresa.' });
  }
}

/** Mismo esquema para los terceros (reencauchadoras). */
export const esquemaEmpresaExterna = esquemaProveedor;
