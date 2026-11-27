-- Revierte 0047: las ventas de las llantas reencauchadas se eliminan (el
-- cobro sigue registrado en la llanta) y la venta pierde el enlace.
DELETE FROM venta WHERE reencauche_llanta_id IS NOT NULL;
DROP FUNCTION IF EXISTS venta_de_reencauche(INTEGER);
ALTER TABLE venta DROP COLUMN IF EXISTS reencauche_llanta_id;
