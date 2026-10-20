-- Revierte 0010. El stock vuelve en 0 (sus valores anteriores no se pueden
-- recuperar) y las solicitudes sin método de pago quedan como "Contado".
ALTER TABLE cotizacion_detalle
  DROP CONSTRAINT IF EXISTS cotizacion_detalle_costo_completo,
  DROP COLUMN IF EXISTS costo_confirmado_por,
  DROP COLUMN IF EXISTS costo_confirmado_en,
  DROP COLUMN IF EXISTS costo_proveedor,
  DROP COLUMN IF EXISTS proveedor_id;

ALTER TABLE cotizacion
  DROP CONSTRAINT IF EXISTS cotizacion_vigencia,
  DROP COLUMN IF EXISTS vence_en,
  DROP COLUMN IF EXISTS emitida_en;
UPDATE cotizacion SET metodo_pago = 'Contado' WHERE metodo_pago IS NULL;
ALTER TABLE cotizacion ALTER COLUMN metodo_pago SET NOT NULL;

ALTER TABLE compra ADD COLUMN stock_aplicado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE producto ADD COLUMN stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);

ALTER TABLE producto ALTER COLUMN codigo DROP DEFAULT;
DROP FUNCTION IF EXISTS siguiente_codigo_producto();
DROP SEQUENCE IF EXISTS producto_codigo_seq;
