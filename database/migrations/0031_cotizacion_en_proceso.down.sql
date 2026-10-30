-- Revierte 0031: vuelve a admitirse el estado "Aprobada" en las cotizaciones.
ALTER TABLE cotizacion DROP CONSTRAINT cotizacion_estado_check;
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_estado_check
  CHECK (estado IN ('Pendiente', 'Aprobada', 'En proceso', 'Completada', 'Rechazada'));
