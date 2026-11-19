-- Revierte 0043: la solicitud vuelve a llevar solo la dirección de entrega.
-- Las que se recogían en el local quedan con esa indicación como dirección.
UPDATE cotizacion SET direccion_entrega = 'Recoge en el local'
 WHERE modo_entrega = 'Recoge' AND direccion_entrega IS NULL;

ALTER TABLE cotizacion
  DROP COLUMN IF EXISTS observaciones,
  DROP COLUMN IF EXISTS fecha_requerida,
  DROP COLUMN IF EXISTS telefono_contacto,
  DROP COLUMN IF EXISTS modo_entrega;
