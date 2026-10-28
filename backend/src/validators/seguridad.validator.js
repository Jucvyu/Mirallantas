import { z } from 'zod';
import {
  correo,
  documentoSegunTipo,
  idRelacion,
  nombreEntidad,
  nombrePersona,
  numeroDocumento,
  password,
  telefono,
  texto,
  textoExplicadoOpcional,
  tipoDocumento,
} from './comunes.validator.js';

/** Rol con los nombres de los módulos marcados ("Clientes", "Ventas"…). */
export const esquemaRol = z.object({
  nombre: nombreEntidad(60),
  descripcion: textoExplicadoOpcional(80),
  permisos: z.array(z.string().trim().min(1)).min(1, 'Marca al menos un módulo.'),
  // Nivel 3: privilegios de cada módulo marcado (los que falten quedan en true)
  privilegios: z
    .record(z.string(), z.object({ crear: z.boolean(), editar: z.boolean(), eliminar: z.boolean() }))
    .optional(),
  activo: z.boolean().optional(),
});

const camposUsuario = {
  nombre: nombrePersona(80),
  tipoDocumento,
  numeroDocumento,
  correo,
  telefono: telefono.nullable().optional(),
  rolId: idRelacion,
};

/** Cuenta nueva: la contraseña es obligatoria. */
export const esquemaNuevoUsuario = z.object({ ...camposUsuario, password }).superRefine(documentoSegunTipo);

/** Edición: todo es opcional; la contraseña solo si se cambia. */
export const esquemaEdicionUsuario = z
  .object({ ...camposUsuario, password, activo: z.boolean() })
  .partial()
  .superRefine(documentoSegunTipo);
