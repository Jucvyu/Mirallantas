-- Revierte 0032: una llanta vuelve a tener un solo proveedor en su línea.
-- Las líneas con reparto en la tabla hija se dejan sin proveedor confirmado.
UPDATE cotizacion_detalle SET costo_confirmado_en = NULL, costo_confirmado_por = NULL
 WHERE proveedor_id IS NULL
   AND EXISTS (SELECT 1 FROM cotizacion_detalle_proveedor dp WHERE dp.detalle_id = cotizacion_detalle.id);

DROP TABLE IF EXISTS cotizacion_detalle_proveedor;

ALTER TABLE cotizacion_detalle ADD CONSTRAINT cotizacion_detalle_verificacion_con_proveedor
  CHECK (costo_confirmado_en IS NULL OR proveedor_id IS NOT NULL);
