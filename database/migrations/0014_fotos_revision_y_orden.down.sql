-- Revierte 0014: se pierden las fotos extra, la observación y el orden por cambio.
DROP TRIGGER IF EXISTS cotizacion_actualizado_en ON cotizacion;
DROP FUNCTION IF EXISTS cotizacion_marcar_cambio();
ALTER TABLE cotizacion DROP COLUMN IF EXISTS actualizado_en;
ALTER TABLE solicitud_servicio DROP COLUMN IF EXISTS observacion_revision, DROP COLUMN IF EXISTS motivo_cancelacion,
  DROP COLUMN IF EXISTS fotos;
