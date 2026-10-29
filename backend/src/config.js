/**
 * Configuración de la API, leída una sola vez de las variables de entorno.
 *
 * Falla al arrancar —y no a la primera petición— si falta algo
 * imprescindible, para que un despliegue mal configurado no quede a medias.
 * Los secretos (claves, contraseñas) solo viven en variables de entorno:
 * nunca se escriben en el código ni se suben al repositorio.
 */

const entorno = process.env.NODE_ENV ?? 'development';
const esProduccion = entorno === 'production';

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}. Revisa backend/.env.`);
  return valor;
}

/** Secreto obligatorio de al menos 32 caracteres. */
function secreto(nombre) {
  const valor = requerida(nombre);
  if (valor.length < 32) throw new Error(`${nombre} debe tener al menos 32 caracteres.`);
  return valor;
}

const jwtSecret = secreto('JWT_SECRET');
const claveCifrado = secreto('CLAVE_CIFRADO');
if (claveCifrado === jwtSecret) throw new Error('CLAVE_CIFRADO debe ser distinta de JWT_SECRET.');

// Cloudinary guarda las imágenes subidas (fotos y comprobantes). En
// producción es obligatorio: la base no debe llenarse de imágenes.
const cloudinaryUrl = process.env.CLOUDINARY_URL ?? '';
if (esProduccion && !cloudinaryUrl) {
  throw new Error('Falta CLOUDINARY_URL: en producción las imágenes se guardan en Cloudinary.');
}

// Captcha del inicio de sesión (Cloudflare Turnstile). En producción es
// obligatorio: sin él cualquiera podría probar contraseñas con un programa.
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY ?? '';
if (esProduccion && !turnstileSecret) {
  throw new Error('Falta TURNSTILE_SECRET_KEY: en producción el inicio de sesión exige el captcha.');
}

// Correo saliente con Brevo (https://brevo.com): por ahora solo envía el
// código para recuperar la contraseña. En producción es obligatorio; en
// desarrollo, sin clave, el código se muestra en la consola de la API.
const correo = {
  brevoApiKey: process.env.BREVO_API_KEY ?? '',
  // Correo verificado como remitente en Brevo, p. ej. "MiraLlantas <tucorreo@gmail.com>"
  remitente: process.env.CORREO_REMITENTE ?? '',
};
if (esProduccion && (!correo.brevoApiKey || !correo.remitente)) {
  throw new Error('Faltan BREVO_API_KEY o CORREO_REMITENTE: en producción se envía el código de recuperación.');
}

const corsOrigenes = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (esProduccion && corsOrigenes.some((o) => o === '*' || o.startsWith('http://'))) {
  throw new Error('En producción CORS_ORIGINS solo admite direcciones https concretas (sin *).');
}

export const config = Object.freeze({
  entorno,
  esProduccion,
  esPrueba: entorno === 'test',
  puerto: Number(process.env.PORT ?? 3000),
  databaseUrl: requerida('DATABASE_URL'),
  // SSL hacia PostgreSQL: 'true' verifica el certificado del servidor (lo
  // correcto); 'no-verify' cifra sin verificarlo (solo si el proveedor no
  // ofrece un certificado verificable); 'false' sin SSL (desarrollo local).
  databaseSsl: process.env.DATABASE_SSL ?? 'false',
  jwtSecret,
  // Duración máxima de una sesión. Además el frontend la cierra tras 30
  // minutos sin actividad.
  jwtExpiraEn: process.env.JWT_EXPIRES_IN ?? '8h',
  // Clave para cifrar datos sensibles en la base (secretos del doble factor)
  claveCifrado,
  // true: el Administrador debe activar el doble factor para usar el panel.
  // Por ahora es opcional (false): cada quien lo activa desde su perfil.
  exigir2faAdmin: process.env.EXIGIR_2FA_ADMIN === 'true',
  cloudinaryUrl,
  turnstileSecret,
  correo,
  // "Iniciar sesión con Google": ID de cliente OAuth (opcional; sin él el botón no aparece)
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  // Orígenes del frontend autorizados, separados por coma
  corsOrigenes,
  // Límite de peticiones por usuario (cubo de fichas): cuántas caben en el
  // cubo y cuántas se recargan por minuto. En las pruebas está apagado
  // salvo que se fije LIMITE_API_FICHAS.
  // 200 por minuto: abrir una pantalla del panel pide ~6-10 cosas y cada
  // cambio de otro empleado (tiempo real) recarga ~4-6 listados en cada
  // pestaña abierta. Un día muy movido ronda las 100-120 por minuto; con
  // 200 sobra margen y un programa que abuse queda frenado igual.
  limiteApi: {
    activo: entorno !== 'test' || Boolean(process.env.LIMITE_API_FICHAS),
    capacidad: Number(process.env.LIMITE_API_FICHAS ?? 200),
    porMinuto: Number(process.env.LIMITE_API_POR_MINUTO ?? process.env.LIMITE_API_FICHAS ?? 200),
  },
  // Zona horaria del negocio: define qué día es "hoy" para fechas y vigencias
  zonaHoraria: process.env.APP_TIMEZONE ?? 'America/Bogota',
});
