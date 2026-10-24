import { z } from 'zod';
import { config } from '../config.js';
import { esImagenPropia, guardarImagen, problemaDeImagen } from '../utils/imagenes.js';

/**
 * Piezas de validación que comparten todos los módulos.
 *
 * Cada módulo arma sus esquemas (qué campos acepta y con qué reglas) en su
 * propio archivo `*.validator.js` usando estas piezas. El middleware
 * `validar` (middleware/validar.js) es el que aplica el esquema a la
 * petición.
 *
 * Se usa la API actual de Zod 4: z.email(), z.url(), z.strictObject() y la
 * opción { error } para los mensajes.
 */

// ---- Parámetros de la URL ---------------------------------------------------

/** Parámetro `:id` numérico positivo. */
export const esquemaId = z.object({ id: z.coerce.number().int().positive('El id no es válido.') });

/** Parámetros comunes de los listados: búsqueda y paginación. */
export const esquemaListado = z.object({
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
  activo: z.enum(['true', 'false']).optional(),
});

/**
 * Listado que además acepta filtros exactos por nombre, por ejemplo
 * listadoCon(['estado', 'clienteId']) → ?estado=Pendiente&clienteId=3
 */
export function listadoCon(nombresFiltros) {
  return esquemaListado.extend(
    Object.fromEntries(nombresFiltros.map((nombre) => [nombre, z.string().trim().max(60).optional()])),
  );
}

// ---- Campos reutilizables -----------------------------------------------------

/**
 * Valor de una lista que vive en la base de datos (tipo de documento,
 * método o medio de pago). Aquí solo se revisa la forma; que exista en su
 * tabla lo garantiza la llave foránea de la base (ver migración 0005).
 */
const deLista = (mensaje) => z.string({ error: mensaje }).trim().min(1, mensaje).max(30, mensaje);

export const tipoDocumento = deLista('Selecciona el tipo de documento.');
export const metodoPago = deLista('Selecciona el método de pago.');
export const medioPago = deLista('Selecciona el medio de pago.');

export const numeroDocumento = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z-]{5,20}$/, 'El número de documento solo admite dígitos, letras y guion (5 a 20).');

/** Formato del número según el tipo de documento (reglas colombianas). */
const REGLAS_DOCUMENTO = {
  CC: [/^\d{6,10}$/, 'La cédula de ciudadanía tiene de 6 a 10 dígitos.'],
  CE: [/^[0-9A-Za-z]{6,12}$/, 'La cédula de extranjería tiene de 6 a 12 letras o números.'],
  NIT: [/^\d{9,10}(-\d)?$/, 'El NIT tiene 9 o 10 dígitos (con guion y dígito de verificación opcional).'],
  Pasaporte: [/^[0-9A-Za-z]{6,15}$/, 'El pasaporte tiene de 6 a 15 letras o números.'],
};

/**
 * Para `.superRefine` de un esquema con tipo y número de documento: revisa
 * el número según su tipo (si llegan los dos).
 */
export function documentoSegunTipo(datos, ctx) {
  const regla = REGLAS_DOCUMENTO[datos.tipoDocumento];
  if (regla && datos.numeroDocumento && !regla[0].test(datos.numeroDocumento)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: regla[1] });
  }
}

/** Letras (con tildes y ñ), espacios, punto y apóstrofo: nombres de personas. */
const LETRAS_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.' ]+$/;

/** Nombre de una persona: mínimo 3 caracteres y solo letras (sin números). */
export const nombrePersona = (max = 150) =>
  z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(max)
    .regex(LETRAS_NOMBRE, 'El nombre solo admite letras, espacios, punto y apóstrofo.');

/** Nombre de una empresa o de un elemento del catálogo: mínimo 2 caracteres y con alguna letra. */
export const nombreEntidad = (max = 150) =>
  z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(max)
    .refine((v) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v), { error: 'El nombre no puede ser solo números o símbolos.' });

/** Texto que debe explicar algo (descripciones, motivos, observaciones): mínimo 10 caracteres. */
export const textoExplicado = (max = 500) =>
  z.string().trim().min(10, 'Escribe al menos 10 caracteres.').max(max);

/** Igual, pero opcional: si llega con texto, mínimo 10 caracteres; vacío se guarda como null. */
export const textoExplicadoOpcional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => v === '' || v.length >= 10, { error: 'Escribe al menos 10 caracteres.' })
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Texto obligatorio con largo máximo. */
export const texto = (max = 200) => z.string().trim().min(1, 'Este campo es obligatorio.').max(max);

/** Texto opcional: si llega vacío se guarda como null. */
export const textoOpcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Valor en pesos colombianos enteros, sin decimales. */
export const pesos = z.coerce.number().int('Debe ser un valor en pesos enteros.').min(0, 'No puede ser negativo.');

/** Valor en pesos mayor que cero. */
export const pesosPositivos = (mensaje) => pesos.refine((v) => v > 0, { error: mensaje });

/** Id de otra tabla (cliente, proveedor…). */
export const idRelacion = z.coerce.number().int().positive('Selecciona un valor de la lista.');

/** Hoy en la zona horaria del negocio, como AAAA-MM-DD (en-CA da ese formato). */
const hoyNegocio = () => new Intl.DateTimeFormat('en-CA', { timeZone: config.zonaHoraria }).format(new Date());

/**
 * Fecha en formato AAAA-MM-DD, como la entrega un <input type="date">. No
 * puede ser posterior a hoy: todas las fechas que se escriben (venta,
 * recepción de un reencauche) registran algo que ya pasó.
 */
export const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.')
  .refine((valor) => valor <= hoyNegocio(), { error: 'La fecha no puede ser posterior a hoy.' });

/** Cantidad de unidades de una línea de detalle. */
export const cantidad = (maximo = 999) =>
  z.coerce.number().int('La cantidad debe ser un número entero.').min(1, 'La cantidad mínima es 1.').max(maximo);

/**
 * Imagen subida desde el navegador. El frontend la lee con FileReader y la
 * envía como "data URL" (data:image/png;base64,…).
 *
 * 1. Se revisa que de verdad sea PNG, JPG o WEBP de máximo 3 MB, mirando
 *    los bytes del archivo y no solo lo que dice ser (utils/imagenes.js).
 * 2. Se sube a Cloudinary y lo que queda en `req.validado` es su dirección
 *    https. Por eso el middleware `validar` usa la versión asíncrona de Zod.
 *
 * También acepta una imagen que ya está en nuestra cuenta de Cloudinary
 * (por ejemplo, al reenviar la misma foto); ninguna otra dirección externa.
 */
export const imagen = z
  .string()
  .max(5_000_000, 'La imagen es demasiado grande (máximo 3 MB).')
  .superRefine((valor, ctx) => {
    if (esImagenPropia(valor)) return;
    const problema = problemaDeImagen(valor);
    if (problema) ctx.addIssue({ code: 'custom', message: problema });
  })
  .transform((valor) => (esImagenPropia(valor) ? valor : guardarImagen(valor)));

/**
 * Correo: primero se limpian espacios y mayúsculas y luego se valida el
 * formato (`pipe` encadena los dos pasos en ese orden).
 */
export const correo = z
  .string()
  .trim()
  .toLowerCase()
  .max(150)
  .pipe(z.email({ error: 'El correo no es válido.' }));

/**
 * Teléfono colombiano: celular de 10 dígitos que empieza por 3 o fijo de 10
 * dígitos que empieza por 60, con +57 opcional. Se guarda sin espacios.
 */
export const telefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(\+57)?(3\d{9}|60\d{8})$/.test(v), {
    error: 'Escribe un celular (3xx xxx xxxx) o un fijo (60x xxx xxxx) colombiano.',
  });

/**
 * Contraseña nueva: al menos 10 caracteres con letras y números. bcrypt
 * solo usa los primeros 72 caracteres.
 */
export const password = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(72, 'La contraseña admite máximo 72 caracteres.')
  .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, 'La contraseña debe tener al menos una letra.')
  .regex(/[0-9]/, 'La contraseña debe tener al menos un número.');

/** Código de 6 dígitos de la app autenticadora. */
export const codigo2fa = z.string().trim().regex(/^\d{6}$/, 'Escribe los 6 dígitos de tu app autenticadora.');

/**
 * Objeto que rechaza campos desconocidos (por ejemplo, intentar cambiar el
 * código de un producto). `mensaje` es lo que verá el usuario.
 */
export const objetoEstricto = (forma, mensaje) => z.strictObject(forma, { error: mensaje });
