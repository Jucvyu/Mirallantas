-- Revierte 0002: quita las columnas agregadas (y los datos que guardaban).
UPDATE producto SET precio_compra = 0 WHERE precio_compra IS NULL;
ALTER TABLE producto
  ALTER COLUMN precio_compra SET DEFAULT 0,
  ALTER COLUMN precio_compra SET NOT NULL;

ALTER TABLE usuario DROP COLUMN IF EXISTS foto_url;

ALTER TABLE cotizacion
  DROP COLUMN IF EXISTS cuota_inicial_comprobante,
  DROP COLUMN IF EXISTS cuota_inicial_medio;
