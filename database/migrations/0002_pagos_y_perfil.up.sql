-- =========================================================================
-- 0002 · Datos que piden los flujos del frontend
--
--   · Cuota inicial de la cotización a crédito: el portal exige pagarla
--     antes de enviar la cotización, con su medio de pago y, si no es en
--     efectivo, el pantallazo de la consignación.
--   · Foto de perfil del usuario (la muestra el menú del avatar).
--   · Un producto nuevo no tiene precio de compra hasta su primera compra:
--     queda vacío (NULL) en vez de un 0 que parecería un precio real.
--
-- No borra datos existentes.
-- =========================================================================

ALTER TABLE cotizacion
  ADD COLUMN cuota_inicial_medio TEXT
    CHECK (cuota_inicial_medio IN ('Efectivo', 'Transferencia', 'Tarjeta')),
  ADD COLUMN cuota_inicial_comprobante TEXT;

ALTER TABLE usuario
  ADD COLUMN foto_url TEXT;

ALTER TABLE producto
  ALTER COLUMN precio_compra DROP NOT NULL,
  ALTER COLUMN precio_compra DROP DEFAULT;
