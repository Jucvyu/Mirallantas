// =========================================================================
// Imagen por defecto.
//
// Si una imagen no carga (por ejemplo, ya no existe en Cloudinary o la
// dirección está rota), en vez del texto alternativo se muestra una imagen
// neutra de "Sin imagen". Se aplica a todas las <img> de la aplicación con
// un solo escucha del evento "error" (fase de captura: ese evento no burbujea).
// =========================================================================

/** Ilustración neutra (gris, funciona en tema claro y oscuro). */
export const IMAGEN_RESPALDO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#E2E8F0"/>
    <circle cx="100" cy="88" r="44" fill="none" stroke="#94A3B8" stroke-width="10"/>
    <circle cx="100" cy="88" r="16" fill="#94A3B8"/>
    <text x="100" y="168" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#64748B" text-anchor="middle">Sin imagen</text>
  </svg>`,
)}`;

/** Activa el respaldo para toda la aplicación (una sola vez, al iniciar). */
export function activarImagenRespaldo() {
  document.addEventListener(
    'error',
    (evento) => {
      const imagen = evento.target;
      if (!(imagen instanceof HTMLImageElement)) return;
      // Solo una vez por imagen: si el respaldo también fallara, no se repite
      if (imagen.dataset.respaldo === 'si') return;
      imagen.dataset.respaldo = 'si';
      imagen.removeAttribute('srcset');
      imagen.src = IMAGEN_RESPALDO;
    },
    true,
  );
}
