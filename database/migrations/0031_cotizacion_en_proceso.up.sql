-- =========================================================================
-- 0031 · La cotización pasa a "En proceso" al pagarse (ya no "Aprobada")
--
-- Antes, al confirmarse el pago (contado o cuota inicial) la cotización
-- quedaba "Aprobada". Ahora pasa directo a "En proceso", y al terminar la
-- compra y el reencauche se completa sola. El estado "Aprobada" desaparece
-- del flujo: las que estuvieran así pasan a "En proceso".
-- =========================================================================

UPDATE cotizacion SET estado = 'En proceso' WHERE estado = 'Aprobada';

ALTER TABLE cotizacion DROP CONSTRAINT cotizacion_estado_check;
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_estado_check
  CHECK (estado IN ('Pendiente', 'En proceso', 'Completada', 'Rechazada'));
