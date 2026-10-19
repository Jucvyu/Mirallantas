-- Revierte 0007
DROP TABLE IF EXISTS notificacion;
ALTER TABLE abono DROP COLUMN IF EXISTS motivo_rechazo;
ALTER TABLE solicitud_servicio
  DROP COLUMN IF EXISTS pago_motivo,
  DROP COLUMN IF EXISTS pago_fecha,
  DROP COLUMN IF EXISTS pago_comprobante,
  DROP COLUMN IF EXISTS pago_medio,
  DROP COLUMN IF EXISTS pago_estado,
  DROP COLUMN IF EXISTS precio;
