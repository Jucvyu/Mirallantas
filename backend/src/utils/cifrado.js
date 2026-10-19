import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

/**
 * Cifrado de datos sensibles que se guardan en la base (por ejemplo, el
 * secreto del doble factor). Si alguien roba una copia de la base, sin la
 * variable CLAVE_CIFRADO no puede leerlos.
 *
 * Usa AES-256-GCM, que además de cifrar detecta si el texto fue alterado.
 * Formato guardado: "v1.<iv>.<etiqueta>.<cifrado>" (cada parte en base64url).
 */

// AES-256 necesita una clave de 32 bytes exactos: se deriva de la variable
const CLAVE = createHash('sha256').update(config.claveCifrado).digest();

export function cifrar(texto) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', CLAVE, iv);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return ['v1', iv, etiqueta, cifrado].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function descifrar(guardado) {
  const [version, iv, etiqueta, cifrado] = String(guardado).split('.');
  if (version !== 'v1') throw new Error('Formato de dato cifrado desconocido.');
  const descifrador = createDecipheriv('aes-256-gcm', CLAVE, Buffer.from(iv, 'base64url'));
  descifrador.setAuthTag(Buffer.from(etiqueta, 'base64url'));
  return Buffer.concat([descifrador.update(Buffer.from(cifrado, 'base64url')), descifrador.final()]).toString('utf8');
}

/**
 * Huella (HMAC-SHA256) de un dato que solo se necesita comparar, nunca
 * leer, como el código de recuperación de contraseña. Sin CLAVE_CIFRADO no
 * se puede probar código por código contra la huella guardada.
 */
export function huella(texto) {
  return createHmac('sha256', CLAVE).update(String(texto)).digest('hex');
}

/** ¿El texto corresponde a la huella? (comparación en tiempo constante) */
export function coincideHuella(texto, huellaGuardada) {
  const a = Buffer.from(huella(texto), 'hex');
  const b = Buffer.from(String(huellaGuardada), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
