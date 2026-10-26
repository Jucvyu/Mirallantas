-- =========================================================================
-- 0018 · Proveedor de cada línea de la compra
--
-- Las llantas de la cotización de origen ya traen el proveedor con el que
-- se verificaron. Un producto adicional (que no estaba en la cotización)
-- exige elegir su proveedor y su precio de compra: se guarda en la línea.
--
-- No borra datos existentes.
-- =========================================================================

ALTER TABLE compra_detalle ADD COLUMN proveedor_id INTEGER REFERENCES proveedor (id);
