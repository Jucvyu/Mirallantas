// =========================================================================
// Configuración pública del frontend (variables VITE_*).
//
// Vite incluye estas variables en el código que se descarga el navegador:
// aquí solo van datos públicos (direcciones, números de contacto), nunca
// claves ni secretos. En Vercel se definen en Settings → Environment
// Variables y se leen al compilar (hay que volver a desplegar).
// =========================================================================

const soloDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

/**
 * Dirección de la API. En desarrollo, si no se define, es la local. En
 * producción es obligatoria: sin ella la app avisa en vez de llamar a
 * localhost.
 */
export const URL_API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000/api' : '');

/**
 * WhatsApp de la empresa, con indicativo de país y solo dígitos
 * (573108976943). Por defecto, el número que ya publica el sitio en su pie
 * de página; VITE_WHATSAPP_NUMERO permite cambiarlo sin tocar el código.
 */
export const WHATSAPP_EMPRESA = soloDigitos(import.meta.env.VITE_WHATSAPP_NUMERO ?? '573108976943');

/** Teléfono de la empresa tal como se muestra. */
export const TELEFONO_EMPRESA = import.meta.env.VITE_TELEFONO_EMPRESA ?? '+57 310 897 69 43';

/** Dirección y correo de la empresa (los que ya publica el pie de página). */
export const DIRECCION_EMPRESA = 'Calle 34 #81-27, Medellín';
export const CORREO_EMPRESA = 'contabilidadmirallantas@gmail.com';

/**
 * ID de cliente OAuth de Google para "Continuar con Google" (es público: va
 * en el botón). Sin él, el botón no aparece. Debe ser el mismo que
 * GOOGLE_CLIENT_ID de la API.
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
