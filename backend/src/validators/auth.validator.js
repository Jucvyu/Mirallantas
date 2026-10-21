import { z } from 'zod';
import {
  codigo2fa,
  correo,
  imagen,
  numeroDocumento,
  password,
  telefono,
  texto,
  textoOpcional,
  tipoDocumento,
} from './comunes.validator.js';

/** POST /auth/login */
/** POST /auth/google — el token que Google le entregó al navegador. */
export const esquemaGoogle = z.object({
  credencial: z.string({ error: 'Falta la respuesta de Google.' }).min(20).max(4096),
});

export const esquemaLogin = z.object({
  correo: z.string().trim().toLowerCase().min(1, 'Escribe tu correo.').max(150),
  password: z.string().min(1, 'Escribe tu contraseña.').max(72),
});

/** Contraseña actual, para confirmar acciones sensibles. */
const passwordActual = z.string().max(72);

/** POST /auth/2fa/verificar — segundo paso del login. */
export const esquemaVerificar2fa = z.object({
  desafio: z.string().min(1).max(1000),
  codigo: codigo2fa,
});

/** POST /auth/2fa/activar */
export const esquemaActivar2fa = z.object({ codigo: codigo2fa });

/** POST /auth/2fa/desactivar */
export const esquemaDesactivar2fa = z.object({ passwordActual, codigo: codigo2fa });

/** POST /auth/registro — cuenta nueva de cliente desde el login. */
export const esquemaRegistro = z.object({
  nombre: texto(150),
  tipoDocumento,
  numeroDocumento,
  telefono,
  direccion: textoOpcional(200),
  correo,
  password,
});

/**
 * PUT /auth/yo — el usuario edita su propio perfil. El rol y el estado no
 * están aquí a propósito: nadie se cambia su propio rol. Si los envía, Zod
 * simplemente los ignora.
 */
export const esquemaPerfil = z
  .object({
    nombre: texto(150),
    tipoDocumento,
    numeroDocumento,
    correo,
    telefono: telefono.nullable(),
    direccion: textoOpcional(200),
    foto: imagen.nullable(),
    password,
    // Obligatoria para cambiar la contraseña o el correo
    passwordActual,
  })
  .partial();

// ---- ¿Olvidaste tu contraseña? ---------------------------------------------------

/** Id de una solicitud de recuperación (UUID). */
const solicitud = z.uuid({ error: 'La solicitud no es válida. Vuelve a empezar.' });

/** POST /auth/recuperar/solicitar */
export const esquemaSolicitarRecuperacion = z.object({ correo });

/** POST /auth/recuperar/verificar */
export const esquemaVerificarRecuperacion = z.object({ solicitud, codigo: codigo2fa });

/** POST /auth/recuperar/cambiar */
export const esquemaCambiarRecuperacion = z.object({ solicitud, password });
