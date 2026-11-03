-- Revierte 0035: vuelve la restricción de la cuota inicial. NOT VALID porque
-- las ventas a crédito ya pueden valer menos que su cuota (la venta nueva y
-- los totales recalculados se conservan: son el dinero realmente cobrado).
ALTER TABLE venta ADD CONSTRAINT venta_cuota_no_supera_total CHECK (cuota_inicial <= total) NOT VALID;
