-- =========================================================================
-- 0013 · Precio de compra del reencauche
--
--   · solicitud_servicio.costo: lo que cobra el tercero (la reencauchadora)
--     por el servicio. Junto con `precio` (lo que paga el cliente) deja ver
--     la ganancia. Es opcional: las solicitudes anteriores quedan sin costo.
-- =========================================================================

ALTER TABLE solicitud_servicio ADD COLUMN costo BIGINT CHECK (costo > 0);
