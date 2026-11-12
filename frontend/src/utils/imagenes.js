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

// ---- PDF (ficha técnica del fabricante) -------------------------------------

/** Formato aceptado para la ficha técnica. Va en el `accept` del input. */
export const TIPOS_PDF = 'application/pdf';

/** Tamaño máximo del PDF: 5 MB. */
const MAXIMO_BYTES_PDF = 5 * 1024 * 1024;

/** Lee un PDF del <input type="file"> y devuelve su data URL (o falla con un mensaje). */
export function leerPdf(archivo) {
  return new Promise((resolver, rechazar) => {
    if (archivo.type !== TIPOS_PDF) {
      rechazar(new Error('El archivo debe ser un PDF.'));
      return;
    }
    if (archivo.size > MAXIMO_BYTES_PDF) {
      rechazar(new Error('El PDF es demasiado grande (máximo 5 MB).'));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(new Error('No se pudo leer el PDF.'));
    lector.readAsDataURL(archivo);
  });
}

/**
 * Abre un PDF en otra pestaña. Si es una data URL (desarrollo, o recién
 * elegido en el formulario) se convierte en un archivo temporal: los
 * navegadores no dejan abrir data URLs directamente.
 */
export function abrirPdf(direccion) {
  if (!direccion) return;
  if (!direccion.startsWith('data:')) {
    window.open(direccion, '_blank', 'noopener');
    return;
  }
  const base64 = direccion.split(',')[1] ?? '';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const enlace = URL.createObjectURL(new Blob([bytes], { type: TIPOS_PDF }));
  window.open(enlace, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(enlace), 60_000);
}
