-- =========================================================================
-- 0041 · Posición por medida y ficha técnica en PDF
--
--   · La posición (Direccional, Tracción, Cualquier posición) pasa del
--     modelo a cada referencia (medida): así un mismo producto, p. ej.
--     "Michelin X Multi", ofrece medidas para tracción y para dirección, y
--     el cliente elige primero la posición y luego la medida. Cada medida
--     toma la posición que tenía su modelo.
--   · Una misma medida puede repetirse en el modelo si es de otra posición:
--     el índice único producto_referencia_unica la incluye.
--   · modelo_llanta.ficha_pdf: el PDF de la ficha técnica del fabricante
--     (dirección de Cloudinary). Se anota para limpiarlo cuando se cambia y
--     cuenta como "en uso" para la limpieza de archivos.
-- =========================================================================

ALTER TABLE producto
  ADD COLUMN posicion TEXT CONSTRAINT producto_posicion_valida
    CHECK (posicion IN ('Direccional', 'Tracción', 'Cualquier posición'));

-- Cada medida hereda la posición de su modelo (la reencauchada no lleva)
UPDATE producto p
   SET posicion = ml.posicion
  FROM modelo_llanta ml
 WHERE ml.id = p.modelo_id AND NOT p.reencauchada AND ml.posicion IS NOT NULL;

DROP INDEX producto_referencia_unica;
CREATE UNIQUE INDEX producto_referencia_unica
  ON producto (modelo_id, medidas, COALESCE(indice_carga, ''), COALESCE(posicion, ''))
  WHERE NOT reencauchada;

ALTER TABLE modelo_llanta DROP COLUMN posicion;

-- La función copia la fila del modelo (%ROWTYPE): se vuelve a crear para
-- que todas las conexiones tomen la nueva forma de modelo_llanta
CREATE OR REPLACE FUNCTION producto_desde_modelo() RETURNS trigger AS $$
DECLARE
  m modelo_llanta%ROWTYPE;
BEGIN
  IF NEW.modelo_id IS NULL THEN
    SELECT * INTO m FROM modelo_llanta
     WHERE marca_id = NEW.marca_id AND lower(nombre) = lower(btrim(NEW.nombre));
    IF NOT FOUND THEN
      INSERT INTO modelo_llanta (nombre, descripcion, categoria_id, marca_id, tipo_vehiculo_id)
      VALUES (btrim(NEW.nombre),
              CASE WHEN NEW.reencauchada THEN NULL ELSE NEW.descripcion END,
              NEW.categoria_id, NEW.marca_id,
              CASE WHEN NEW.reencauchada THEN NULL ELSE NEW.tipo_vehiculo_id END)
      RETURNING * INTO m;
    END IF;
    NEW.modelo_id := m.id;
  ELSE
    SELECT * INTO m FROM modelo_llanta WHERE id = NEW.modelo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto seleccionado no existe.';
    END IF;
  END IF;

  NEW.nombre := m.nombre;
  NEW.categoria_id := m.categoria_id;
  NEW.marca_id := m.marca_id;
  -- La reencauchada es una unidad única: su descripción y su vehículo son suyos
  IF NOT NEW.reencauchada THEN
    NEW.descripcion := m.descripcion;
    NEW.tipo_vehiculo_id := m.tipo_vehiculo_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- Ficha técnica en PDF ----------------------------------------------------
ALTER TABLE modelo_llanta ADD COLUMN ficha_pdf TEXT;

-- El PDF que se cambia o se quita se anota para limpiarlo de Cloudinary
CREATE TRIGGER modelo_llanta_archivos AFTER UPDATE OR DELETE ON modelo_llanta
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('ficha_pdf');

CREATE OR REPLACE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE foto_url = direccion)
      OR EXISTS (SELECT 1 FROM producto_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM modelo_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM modelo_llanta WHERE ficha_pdf = direccion)
      OR EXISTS (SELECT 1 FROM solicitud_servicio
                 WHERE foto_url = direccion OR pago_comprobante = direccion OR direccion = ANY (fotos))
      OR EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM venta WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM abono WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM pago_cotizacion WHERE comprobante = direccion)
      OR EXISTS (SELECT 1 FROM reencauche_llanta WHERE pago_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM empresa WHERE logo_url = direccion);
$$ LANGUAGE sql STABLE;
