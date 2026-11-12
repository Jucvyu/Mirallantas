-- Revierte 0041. La posición vuelve al modelo (la más común entre sus
-- medidas) y el PDF de la ficha técnica se quita (se anota para limpiarlo
-- de Cloudinary).

-- Sin la posición, dos medidas iguales de distinta posición chocarían
DO $$
DECLARE
  v_conflicto TEXT;
BEGIN
  SELECT string_agg(format('%s %s', ml.nombre, g.medidas), '; ')
    INTO v_conflicto
    FROM (
      SELECT modelo_id, medidas FROM producto
       WHERE NOT reencauchada
       GROUP BY modelo_id, medidas, COALESCE(indice_carga, '')
      HAVING count(*) > 1
    ) g
    JOIN modelo_llanta ml ON ml.id = g.modelo_id;
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede revertir: estas medidas están repetidas en varias posiciones: %. Deja una sola por medida y vuelve a intentarlo.', v_conflicto;
  END IF;
END;
$$;

INSERT INTO imagen_por_borrar (url)
SELECT ficha_pdf FROM modelo_llanta WHERE ficha_pdf LIKE 'https://res.cloudinary.com/%'
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS modelo_llanta_archivos ON modelo_llanta;
ALTER TABLE modelo_llanta DROP COLUMN IF EXISTS ficha_pdf;

CREATE OR REPLACE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE foto_url = direccion)
      OR EXISTS (SELECT 1 FROM producto_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM modelo_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM solicitud_servicio
                 WHERE foto_url = direccion OR pago_comprobante = direccion OR direccion = ANY (fotos))
      OR EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM venta WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM abono WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM pago_cotizacion WHERE comprobante = direccion)
      OR EXISTS (SELECT 1 FROM reencauche_llanta WHERE pago_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM empresa WHERE logo_url = direccion);
$$ LANGUAGE sql STABLE;

ALTER TABLE modelo_llanta
  ADD COLUMN posicion TEXT CHECK (posicion IN ('Direccional', 'Tracción', 'Cualquier posición'));

UPDATE modelo_llanta ml
   SET posicion = (
     SELECT p.posicion FROM producto p
      WHERE p.modelo_id = ml.id AND p.posicion IS NOT NULL
      GROUP BY p.posicion ORDER BY count(*) DESC, p.posicion LIMIT 1);

DROP INDEX producto_referencia_unica;
CREATE UNIQUE INDEX producto_referencia_unica ON producto (modelo_id, medidas, COALESCE(indice_carga, ''))
  WHERE NOT reencauchada;

ALTER TABLE producto DROP COLUMN IF EXISTS posicion;

-- Igual que en la subida: se vuelve a crear con la forma restaurada
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
  IF NOT NEW.reencauchada THEN
    NEW.descripcion := m.descripcion;
    NEW.tipo_vehiculo_id := m.tipo_vehiculo_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
