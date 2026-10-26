-- =========================================================================
-- 0017 · La compra ya no exige proveedor
--
-- La compra sale de la cotización aprobada con todos sus productos (cada
-- línea ya dice con qué proveedor se verificó). La cabecera guarda el
-- proveedor solo si todas las llantas son del mismo; si no, queda vacío.
--
-- No borra datos existentes.
-- =========================================================================

ALTER TABLE compra ALTER COLUMN proveedor_id DROP NOT NULL;
