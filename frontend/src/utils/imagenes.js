// =========================================================================
// Lectura de imágenes subidas (fotos y comprobantes).
//
// El navegador revisa tipo y tamaño antes de enviar, para avisar enseguida.
// La revisión que de verdad protege está en la API: mira los bytes reales
// del archivo y lo sube a Cloudinary.
// =========================================================================

/** Formatos aceptados (SVG no: puede llevar código). Va en el `accept` del input. */
export const TIPOS_IMAGEN = 'image/png,image/jpeg,image/webp';

/** Tamaño máximo: 3 MB. */
const MAXIMO_BYTES = 3 * 1024 * 1024;

/**
 * Lee un archivo del <input type="file"> y devuelve su data URL. Si no es
 * una imagen permitida o pesa demasiado, la promesa falla con un mensaje
 * listo para mostrar.
 */
export function leerImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    if (!TIPOS_IMAGEN.split(',').includes(archivo.type)) {
      rechazar(new Error('El archivo debe ser una imagen PNG, JPG o WEBP.'));
      return;
    }
    if (archivo.size > MAXIMO_BYTES) {
      rechazar(new Error('La imagen es demasiado grande (máximo 3 MB).'));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    lector.readAsDataURL(archivo);
  });
}
