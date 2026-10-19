import { z } from 'zod';
import {
  correo,
  numeroDocumento,
  pesos,
  telefono,
  texto,
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
  direccion: textoOpcional(200),
};

/** Cuerpo de PATCH /:id/estado */
export const esquemaEstado = z.object({ activo: z.boolean({ error: 'Envía "activo" como true o false.' }) });

export const esquemaCategoria = z.object({
  nombre: texto(80),
  descripcion: textoOpcional(300),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener la forma #RRGGBB.')
    .optional(),
  ...activo,
});

export const esquemaMarca = z.object({ nombre: texto(80), ...activo });

export const esquemaTipoVehiculo = z.object({ nombre: texto(80) });

export const esquemaServicio = z.object({
  nombre: texto(120),
  descripcion: textoOpcional(500),
  precio: pesos,
  garantiaDias: z.coerce.number().int().min(0).max(3650).optional(),
  ...activo,
});

export const esquemaCliente = z.object({
  tipoDocumento,
  numeroDocumento,
  nombreCompleto: texto(150),
  ...contactoOpcional,
  ...activo,
});

/** Proveedores y terceros (reencauchadoras) comparten campos. */
export const esquemaEmpresaExterna = z.object({
  tipoDocumento,
  numeroDocumento,
  nombreRazonSocial: texto(150),
  contacto: textoOpcional(120),
  ...contactoOpcional,
  ...activo,
});
