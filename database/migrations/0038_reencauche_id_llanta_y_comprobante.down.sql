-- Revierte 0038. Un ID que no sea de 4 dígitos no cabe en el DOT: esas
-- llantas quedan con '0000' para que la columna vuelva a su regla.
CREATE OR REPLACE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
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

DROP TRIGGER IF EXISTS reencauche_llanta_imagenes ON reencauche_llanta;
ALTER TABLE reencauche_llanta DROP COLUMN IF EXISTS pago_comprobante;

ALTER TABLE reencauche_llanta
  DROP CONSTRAINT IF EXISTS reencauche_llanta_identificador_unico,
  DROP CONSTRAINT IF EXISTS reencauche_llanta_identificador_formato;
ALTER TABLE reencauche_llanta RENAME COLUMN identificador TO dot;
UPDATE reencauche_llanta SET dot = '0000' WHERE dot !~ '^[0-9]{4}$';
ALTER TABLE reencauche_llanta ADD CONSTRAINT reencauche_llanta_dot_check CHECK (dot ~ '^[0-9]{4}$');
