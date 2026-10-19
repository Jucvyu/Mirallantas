-- Revierte 0008 (el servicio "Reencauche" y el medio "Otro" se conservan si ya se usan)
DROP TABLE IF EXISTS pago_cotizacion;
DELETE FROM medio_pago WHERE nombre = 'Otro'
  AND NOT EXISTS (SELECT 1 FROM abono WHERE medio_pago = 'Otro')
  AND NOT EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_medio = 'Otro')
  AND NOT EXISTS (SELECT 1 FROM solicitud_servicio WHERE pago_medio = 'Otro');
