import { z } from 'zod';
import {
  correo,
  idRelacion,
  numeroDocumento,
  password,
  telefono,
  texto,
  textoOpcional,
  tipoDocumento,
} from './comunes.validator.js';

/** Rol con los nombres de los módulos marcados ("Clientes", "Ventas"…). */
export const esquemaRol = z.object({
  nombre: texto(60),
  descripcion: textoOpcional(300),
  permisos: z.array(z.string().trim().min(1)).min(1, 'Marca al menos un módulo.'),
  activo: z.boolean().optional(),
});

const camposUsuario = {
  nombre: texto(150),
  tipoDocumento,
  numeroDocumento,
  correo,
  telefono: telefono.nullable().optional(),
  rolId: idRelacion,
};

/** Cuenta nueva: la contraseña es obligatoria. */
export const esquemaNuevoUsuario = z.object({ ...camposUsuario, password });

/** Edición: todo es opcional; la contraseña solo si se cambia. */
export const esquemaEdicionUsuario = z.object({ ...camposUsuario, password, activo: z.boolean() }).partial();
