-- Revierte 0013: se pierde el precio de compra registrado de cada reencauche.
ALTER TABLE solicitud_servicio DROP COLUMN IF EXISTS costo;
