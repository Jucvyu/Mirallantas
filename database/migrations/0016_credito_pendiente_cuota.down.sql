-- Revierte 0016: las solicitudes pendientes de cuota vuelven a "Aprobada".
UPDATE solicitud_credito SET estado = 'Aprobada' WHERE estado = 'Pendiente de cuota inicial';
ALTER TABLE solicitud_credito DROP CONSTRAINT solicitud_credito_estado_check;
ALTER TABLE solicitud_credito ADD CONSTRAINT solicitud_credito_estado_check
  CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada'));
ALTER TABLE credito DROP COLUMN IF EXISTS iniciado;
