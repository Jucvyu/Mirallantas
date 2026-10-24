-- =========================================================================
-- 0015 · Limpieza de imágenes en Cloudinary
--
--   · imagen_por_borrar: imágenes de Cloudinary que dejó de usar algún
--     registro (porque se borró o porque se cambió la foto). La API las
--     elimina de Cloudinary para ahorrar espacio (utils/limpiezaImagenes.js).
--   · Un trigger en cada tabla con imágenes las anota. Al ser trigger, también
--     cubre los borrados en cascada (p. ej. las fotos de los reencauches de
--     una cotización que se elimina) y si la transacción falla no anota nada.
--   · imagen_en_uso(url): la misma imagen puede estar en dos registros (la
--     primera foto del reencauche está en foto_url y en fotos, o un comprobante
--     se copia a la venta); solo se borra cuando ya nadie la usa.
-- =========================================================================

CREATE TABLE imagen_por_borrar (
  url       TEXT PRIMARY KEY,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Los argumentos del trigger son las columnas con imágenes de la tabla
-- (texto o arreglo de texto). Anota las que tenía antes y ya no tiene.
CREATE FUNCTION anotar_imagenes_soltadas() RETURNS trigger AS $$
DECLARE
  antes   JSONB := to_jsonb(OLD);
  despues JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  columna TEXT;
BEGIN
  FOR i IN 0 .. TG_NARGS - 1 LOOP
    columna := TG_ARGV[i];
    INSERT INTO imagen_por_borrar (url)
    SELECT v FROM jsonb_array_elements_text(
      CASE jsonb_typeof(antes -> columna)
        WHEN 'array' THEN antes -> columna
        WHEN 'string' THEN jsonb_build_array(antes -> columna)
        ELSE '[]'::jsonb
      END) AS v
    WHERE v LIKE 'https://res.cloudinary.com/%'
      AND NOT jsonb_build_array(v) <@ (
        CASE jsonb_typeof(despues -> columna)
          WHEN 'array' THEN despues -> columna
          WHEN 'string' THEN jsonb_build_array(despues -> columna)
          ELSE '[]'::jsonb
        END)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuario_imagenes AFTER UPDATE OR DELETE ON usuario
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('foto_url');
CREATE TRIGGER producto_imagen_imagenes AFTER UPDATE OR DELETE ON producto_imagen
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('url');
CREATE TRIGGER solicitud_servicio_imagenes AFTER UPDATE OR DELETE ON solicitud_servicio
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('foto_url', 'fotos', 'pago_comprobante');
CREATE TRIGGER cotizacion_imagenes AFTER UPDATE OR DELETE ON cotizacion
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('cuota_inicial_comprobante');
CREATE TRIGGER venta_imagenes AFTER UPDATE OR DELETE ON venta
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('comprobante_url');
CREATE TRIGGER abono_imagenes AFTER UPDATE OR DELETE ON abono
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('comprobante_url');
CREATE TRIGGER pago_cotizacion_imagenes AFTER UPDATE OR DELETE ON pago_cotizacion
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('comprobante');

-- ¿Algún registro sigue usando la imagen?
CREATE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE foto_url = direccion)
      OR EXISTS (SELECT 1 FROM producto_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM solicitud_servicio
                 WHERE foto_url = direccion OR pago_comprobante = direccion OR direccion = ANY (fotos))
      OR EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM venta WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM abono WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM pago_cotizacion WHERE comprobante = direccion)
      OR EXISTS (SELECT 1 FROM empresa WHERE logo_url = direccion);
$$ LANGUAGE sql STABLE;
