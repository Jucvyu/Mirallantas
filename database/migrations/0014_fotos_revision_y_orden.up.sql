-- =========================================================================
-- 0014 · Fotos del reencauche, observación de la revisión y orden del portal
--
--   · solicitud_servicio.fotos: hasta 3 fotos de la llanta (foto_url sigue
--     guardando la primera, para lo que ya la usa).
--   · solicitud_servicio.observacion_revision: lo que anota el asesor al
--     revisar la carcasa (Apta / No apta).
--   · solicitud_servicio.motivo_cancelacion: por qué se canceló el reencauche.
--   · cotizacion.actualizado_en: último cambio; "Mis cotizaciones" muestra
--     primero la que el asesor tocó por última vez. Un trigger lo mantiene.
-- =========================================================================

ALTER TABLE solicitud_servicio
  ADD COLUMN fotos TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(fotos) <= 3),
  ADD COLUMN observacion_revision TEXT,
  ADD COLUMN motivo_cancelacion TEXT;
UPDATE solicitud_servicio SET fotos = ARRAY[foto_url] WHERE foto_url IS NOT NULL;

ALTER TABLE cotizacion ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE cotizacion SET actualizado_en = creado_en;

CREATE FUNCTION cotizacion_marcar_cambio() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cotizacion_actualizado_en
  BEFORE UPDATE ON cotizacion
  FOR EACH ROW EXECUTE FUNCTION cotizacion_marcar_cambio();
