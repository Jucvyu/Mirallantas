import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';

/**
 * Imágenes subidas por los usuarios (fotos de perfil, de productos, de
 * llantas y comprobantes de pago).
 *
 * El navegador las envía como "data URL" (data:image/png;base64,…). Antes
 * de guardarlas se revisa que de verdad sean imágenes y luego se suben a
 * Cloudinary; en la base solo queda la dirección https de la imagen.
 *
 * Sin CLOUDINARY_URL (desarrollo y pruebas) la imagen ya validada se guarda
 * tal cual en la base. En producción config.js exige CLOUDINARY_URL.
 */

/** Tamaño máximo de la imagen ya decodificada. */
export const MAXIMO_BYTES = 3 * 1024 * 1024;

/**
 * Firma ("números mágicos") con la que empieza cada formato permitido. Se
 * revisan los bytes reales: cambiarle la extensión o el tipo a un archivo
 * malicioso no basta para pasar. SVG no se acepta porque puede llevar
 * código JavaScript.
 */
const FIRMAS = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

const PATRON = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Revisa una data URL. Devuelve null si es válida o el motivo del rechazo.
 */
export function problemaDeImagen(dataUrl) {
  const partes = PATRON.exec(dataUrl);
  if (!partes) return 'El archivo debe ser una imagen PNG, JPG o WEBP.';
  const tipo = partes[1] === 'jpg' ? 'jpeg' : partes[1];
  const bytes = Buffer.from(partes[2], 'base64');
  if (bytes.length > MAXIMO_BYTES) return 'La imagen es demasiado grande (máximo 3 MB).';
  if (!FIRMAS[tipo](bytes)) return 'El archivo no es una imagen válida.';
  return null;
}

if (config.cloudinaryUrl) {
  // El SDK lee CLOUDINARY_URL del entorno; aquí solo se exige https
  cloudinary.config({ secure: true });
}

// Nombre de la cuenta: cloudinary://<clave>:<secreto>@<nombre>
const CUENTA = config.cloudinaryUrl.split('@')[1] ?? '';
const PREFIJO_PROPIO = CUENTA ? `https://res.cloudinary.com/${CUENTA}/image/upload/` : null;

/** ¿Es una imagen que ya subimos a nuestra cuenta de Cloudinary? */
export function esImagenPropia(valor) {
  return Boolean(PREFIJO_PROPIO) && valor.startsWith(PREFIJO_PROPIO) && !/[\s"'<>]/.test(valor);
}

/**
 * Guarda una imagen ya validada y devuelve lo que se almacena en la base:
 * la dirección https de Cloudinary, o la misma data URL si no está
 * configurado (solo desarrollo).
 */
export async function guardarImagen(dataUrl) {
  if (!config.cloudinaryUrl) return dataUrl;
  const resultado = await cloudinary.uploader.upload(dataUrl, {
    folder: 'mirallantas',
    // Nombre aleatorio: las direcciones no se pueden adivinar
    public_id: randomUUID(),
    resource_type: 'image',
    allowed_formats: ['png', 'jpg', 'webp'],
    overwrite: false,
  });
  return resultado.secure_url;
}
