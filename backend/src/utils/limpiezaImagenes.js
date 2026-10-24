import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';
import { query } from '../db.js';
import { esImagenPropia } from './imagenes.js';

/**
 * Borra de Cloudinary las imágenes que ya no usa ningún registro.
 *
 * La base anota en `imagen_por_borrar` cada imagen que se suelta al borrar
 * un registro o cambiar su foto (migración 0015). Aquí se recorre esa lista:
 * las que nadie usa se eliminan de Cloudinary y todas salen de la lista (si
 * alguna sigue en uso, el trigger la vuelve a anotar cuando se suelte).
 *
 * Corre en segundo plano después de cada petición que cambia datos y al
 * arrancar la API; un fallo de Cloudinary no afecta la petición, la imagen
 * queda anotada y se reintenta la próxima vez.
 */

const POR_VUELTA = 50;
let enCurso = false;
let pendiente = false;

/** public_id de una dirección de Cloudinary: …/image/upload/v123/carpeta/nombre.webp → carpeta/nombre */
export function idPublico(direccion) {
  const ruta = direccion.split('/image/upload/')[1] ?? '';
  return ruta.replace(/^v\d+\//, '').replace(/\.[a-z0-9]+$/i, '');
}

export async function limpiarImagenes() {
  // Sin Cloudinary (desarrollo y pruebas) no hay nada que borrar
  if (!config.cloudinaryUrl) return;
  if (enCurso) {
    pendiente = true;
    return;
  }
  enCurso = true;
  try {
    do {
      pendiente = false;
      const { rows } = await query(
        'SELECT url, imagen_en_uso(url) AS "enUso" FROM imagen_por_borrar ORDER BY creado_en LIMIT $1',
        [POR_VUELTA],
      );
      let atendidas = 0;
      for (const { url, enUso } of rows) {
        if (!enUso && esImagenPropia(url)) {
          const { result } = await cloudinary.uploader.destroy(idPublico(url), { invalidate: true });
          // 'not found' también vale: ya no está en Cloudinary
          if (result !== 'ok' && result !== 'not found') continue;
        }
        await query('DELETE FROM imagen_por_borrar WHERE url = $1', [url]);
        atendidas += 1;
      }
      // Otra vuelta si la lista venía llena (sin repetir las que fallaron)
      if (rows.length === POR_VUELTA && atendidas > 0) pendiente = true;
    } while (pendiente);
  } catch (error) {
    console.error('No se pudieron limpiar las imágenes de Cloudinary:', error.message);
  } finally {
    enCurso = false;
  }
}
