-- Revierte 0040. Cada producto vuelve a ser independiente: conserva los datos
-- que copiaba de su modelo, recupera su nombre y su descripción originales
-- (si no se cambiaron después de migrar) y vuelve a tener sus fotos.
-- La ficha técnica y los campos de referencia se pierden.

DROP TRIGGER IF EXISTS categoria_inactiva_modelos ON categoria;
DROP FUNCTION IF EXISTS categoria_desactivar_modelos();
DROP TRIGGER IF EXISTS modelo_llanta_sincroniza ON modelo_llanta;
DROP FUNCTION IF EXISTS modelo_sincronizar_referencias();
DROP TRIGGER IF EXISTS producto_copia_modelo ON producto;
DROP FUNCTION IF EXISTS producto_desde_modelo();

-- Nombre y descripción originales, solo si siguen como los dejó la migración
-- (si el modelo se editó después, se respeta lo nuevo)
UPDATE producto p
   SET nombre = r.nombre, descripcion = r.descripcion
  FROM migracion_0040_producto r, modelo_llanta ml
 WHERE r.producto_id = p.id AND ml.id = p.modelo_id
   AND p.nombre = ml.nombre
   AND (p.reencauchada OR p.descripcion IS NOT DISTINCT FROM ml.descripcion)
   AND lower(btrim(r.nombre)) = lower(ml.nombre);

-- Fotos: vuelven las que se movieron al modelo
INSERT INTO producto_imagen (producto_id, url, orden)
SELECT r.producto_id, r.url, r.orden
  FROM migracion_0040_imagen r
  JOIN producto p ON p.id = r.producto_id
 WHERE NOT EXISTS (SELECT 1 FROM producto_imagen i WHERE i.producto_id = r.producto_id AND i.url = r.url);

-- Las fotos que se subieron al modelo después de migrar pasan a cada
-- referencia que no tenga ninguna
INSERT INTO producto_imagen (producto_id, url, orden)
SELECT p.id, mi.url, mi.orden
  FROM producto p
  JOIN modelo_imagen mi ON mi.modelo_id = p.modelo_id
 WHERE NOT EXISTS (SELECT 1 FROM producto_imagen i WHERE i.producto_id = p.id)
 ORDER BY p.id, mi.orden, mi.id;

-- Las fotos de modelos que ya no quedan en ningún producto se anotan para
-- limpiarlas de Cloudinary (borrar la tabla no dispara el trigger)
INSERT INTO imagen_por_borrar (url)
SELECT DISTINCT mi.url FROM modelo_imagen mi
 WHERE mi.url LIKE 'https://res.cloudinary.com/%'
   AND NOT EXISTS (SELECT 1 FROM producto_imagen i WHERE i.url = mi.url)
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS producto_referencia_unica;
DROP INDEX IF EXISTS producto_modelo_idx;
ALTER TABLE producto
  DROP COLUMN IF EXISTS rin,
  DROP COLUMN IF EXISTS perfil,
  DROP COLUMN IF EXISTS ancho,
  DROP COLUMN IF EXISTS codigo_fabricante,
  DROP COLUMN IF EXISTS peso_kg,
  DROP COLUMN IF EXISTS profundidad_labrado,
  DROP COLUMN IF EXISTS lonas,
  DROP COLUMN IF EXISTS indice_carga,
  DROP COLUMN IF EXISTS modelo_id;

-- imagen_en_uso vuelve a la versión de 0038 (sin modelo_imagen)
CREATE OR REPLACE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE foto_url = direccion)
      OR EXISTS (SELECT 1 FROM producto_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM solicitud_servicio
                 WHERE foto_url = direccion OR pago_comprobante = direccion OR direccion = ANY (fotos))
      OR EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM venta WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM abono WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM pago_cotizacion WHERE comprobante = direccion)
      OR EXISTS (SELECT 1 FROM reencauche_llanta WHERE pago_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM empresa WHERE logo_url = direccion);
$$ LANGUAGE sql STABLE;

DROP TABLE IF EXISTS modelo_imagen;
DROP TABLE IF EXISTS modelo_llanta;
DROP TABLE IF EXISTS migracion_0040_imagen;
DROP TABLE IF EXISTS migracion_0040_producto;
