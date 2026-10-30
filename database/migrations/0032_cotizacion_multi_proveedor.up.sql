-- =========================================================================
-- 0032 · Varios proveedores para una misma llanta de la cotización
--
-- Al emitir, una llanta puede repartirse entre varios proveedores: cada uno
-- con su cantidad y su precio de compra. El precio de VENTA es uno solo por
-- llanta. Cuando hay un solo proveedor se sigue guardando en la propia línea
-- (cotizacion_detalle.proveedor_id / costo_proveedor); cuando hay varios, el
-- reparto va en esta tabla hija y la línea deja esos campos en NULL.
--
-- En la orden de compra, cada (proveedor, cantidad, costo) es una línea.
-- =========================================================================

CREATE TABLE cotizacion_detalle_proveedor (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  detalle_id   INTEGER NOT NULL REFERENCES cotizacion_detalle (id) ON DELETE CASCADE,
  proveedor_id INTEGER NOT NULL REFERENCES proveedor (id),
  cantidad     INTEGER NOT NULL CHECK (cantidad > 0),
  costo        BIGINT NOT NULL CHECK (costo >= 0)
);
CREATE INDEX cotizacion_detalle_proveedor_detalle_idx ON cotizacion_detalle_proveedor (detalle_id);

-- La línea confirmada ya no exige proveedor propio: con varios proveedores
-- el reparto vive en la tabla hija (la API garantiza que haya al menos uno).
ALTER TABLE cotizacion_detalle DROP CONSTRAINT cotizacion_detalle_verificacion_con_proveedor;
