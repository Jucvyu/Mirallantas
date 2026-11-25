-- Revierte 0045: cada solicitud vuelve a tener una sola banda y medida (la de
-- su primera línea) y lo que estaba "Por confirmar" queda "Agendada".
UPDATE reencauche SET estado = 'Agendada' WHERE estado = 'Por confirmar';
ALTER TABLE reencauche DROP CONSTRAINT reencauche_estado_check;
ALTER TABLE reencauche ADD CONSTRAINT reencauche_estado_check CHECK (
  estado IN ('Por agendar', 'Agendada', 'Cotizada', 'Aceptada', 'No aceptada', 'Sin llantas aptas', 'Cancelada')
);
ALTER TABLE reencauche DROP COLUMN IF EXISTS fecha_confirmada_en;
DROP TABLE IF EXISTS reencauche_item;
