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

// Correo saliente con Resend (https://resend.com): por ahora solo envía el
// enlace para recuperar la contraseña. En producción es obligatorio; en
// desarrollo, sin clave, el enlace se muestra en la consola de la API.
const correo = {
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  // Debe ser de un dominio verificado en Resend, p. ej. "MiraLlantas <no-responder@tudominio.com>"
  remitente: process.env.CORREO_REMITENTE ?? '',
};
if (esProduccion && (!correo.resendApiKey || !correo.remitente)) {
  throw new Error('Faltan RESEND_API_KEY o CORREO_REMITENTE: en producción se envía el correo de recuperación.');
}

// Dirección pública del frontend: con ella se arma el enlace del correo
const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
if (esProduccion && !frontendUrl.startsWith('https://')) {
  throw new Error('En producción FRONTEND_URL debe ser la dirección https del frontend.');
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
  correo,
  frontendUrl,
  // Orígenes del frontend autorizados, separados por coma
  corsOrigenes,
  // Zona horaria del negocio: define qué día es "hoy" para fechas y vigencias
  zonaHoraria: process.env.APP_TIMEZONE ?? 'America/Bogota',
});
