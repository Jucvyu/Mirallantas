-- Revierte 0033: todos los medios de pago vuelven a ofrecerse.
ALTER TABLE medio_pago DROP COLUMN IF EXISTS activo;
