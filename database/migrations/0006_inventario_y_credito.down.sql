-- Revierte 0006 (las cuentas desligadas no se vuelven a ligar).
ALTER TABLE solicitud_credito DROP COLUMN IF EXISTS cotizacion_id;
ALTER TABLE compra DROP COLUMN IF EXISTS stock_aplicado;
ALTER TABLE cotizacion ALTER COLUMN confirmado SET DEFAULT FALSE;
