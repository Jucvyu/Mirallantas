import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Doble factor con códigos de 6 dígitos que cambian cada 30 segundos
 * (TOTP, RFC 6238). Es el estándar que usan Google Authenticator, Microsoft
 * Authenticator, Authy, 1Password, etc.
 *
 * Cómo funciona:
 *   1. El servidor genera un secreto aleatorio y se lo muestra al usuario
 *      como código QR.
 *   2. La app del celular guarda el secreto y, cada 30 s, calcula
 *      HMAC-SHA1(secreto, minuto actual) → 6 dígitos.
 *   3. Al iniciar sesión, el servidor hace el mismo cálculo y compara.
 *
 * Se implementa con node:crypto (sin librerías) para que se vea completo.
 */

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIODO = 30;
const DIGITOS = 6;

/** Bytes → texto base32 (el formato que leen las apps autenticadoras). */
function aBase32(bytes) {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let texto = '';
  for (let i = 0; i < bits.length; i += 5) texto += ALFABETO_BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return texto;
}

/** Texto base32 → bytes. */
function desdeBase32(texto) {
  let bits = '';
  for (const c of texto.replace(/=+$/, '').toUpperCase()) {
    const valor = ALFABETO_BASE32.indexOf(c);
    if (valor < 0) throw new Error('Secreto base32 no válido.');
    bits += valor.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Secreto nuevo de 160 bits, en base32. */
export function generarSecreto() {
  return aBase32(randomBytes(20));
}

/** Código de 6 dígitos para un intervalo de 30 s (`paso`). */
function codigoEn(secreto, paso) {
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(paso));
  const hmac = createHmac('sha1', desdeBase32(secreto)).update(mensaje).digest();
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const numero = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(numero % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

/** Código vigente en este momento (lo usan las pruebas). */
export function codigoActual(secreto, ahora = Date.now()) {
  return codigoEn(secreto, Math.floor(ahora / 1000 / PERIODO));
}

/**
 * ¿El código es válido? Acepta el intervalo anterior y el siguiente, por
 * si el reloj del celular está un poco desfasado.
 */
export function verificarCodigo(secreto, codigo, ahora = Date.now()) {
  if (!/^\d{6}$/.test(String(codigo))) return false;
  const paso = Math.floor(ahora / 1000 / PERIODO);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(codigoEn(secreto, paso + d)), Buffer.from(String(codigo))));
}

/** Dirección otpauth:// que se convierte en el código QR. */
export function direccionOtpauth(secreto, cuenta, emisor = 'MiraLlantas') {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const parametros = new URLSearchParams({ secret: secreto, issuer: emisor, digits: String(DIGITOS), period: String(PERIODO) });
  return `otpauth://totp/${etiqueta}?${parametros}`;
}
