-- Revierte 0011. Los enlaces vigentes se anulan; las líneas verificadas sin
-- costo quedan como no verificadas para cumplir la regla anterior.
UPDATE cotizacion_detalle SET costo_confirmado_en = NULL, costo_confirmado_por = NULL
 WHERE costo_confirmado_en IS NOT NULL AND costo_proveedor IS NULL;
ALTER TABLE cotizacion_detalle DROP CONSTRAINT IF EXISTS cotizacion_detalle_verificacion_con_proveedor;
ALTER TABLE cotizacion_detalle ADD CONSTRAINT cotizacion_detalle_costo_completo CHECK (
  costo_confirmado_en IS NULL OR (proveedor_id IS NOT NULL AND costo_proveedor IS NOT NULL)
);

DROP INDEX IF EXISTS recuperacion_password_token;
UPDATE recuperacion_password SET usado = TRUE WHERE NOT usado;
ALTER TABLE recuperacion_password RENAME COLUMN token_hash TO codigo_hash;
ALTER TABLE recuperacion_password
  ADD COLUMN intentos_restantes INTEGER NOT NULL DEFAULT 3 CHECK (intentos_restantes >= 0),
  ADD COLUMN verificado BOOLEAN NOT NULL DEFAULT FALSE;
