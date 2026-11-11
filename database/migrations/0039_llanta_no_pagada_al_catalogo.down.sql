-- Revierte 0039. Las llantas "No pagada" vuelven a "Lista para entregar";
-- sus productos se conservan, pero ya no se distinguen como reencauchadas.
UPDATE reencauche_llanta SET estado = 'Lista para entregar', no_pagada_en = NULL WHERE estado = 'No pagada';

ALTER TABLE producto DROP COLUMN IF EXISTS reencauchada;

ALTER TABLE reencauche_llanta
  DROP CONSTRAINT IF EXISTS reencauche_llanta_no_pagada,
  DROP COLUMN IF EXISTS producto_id,
  DROP COLUMN IF EXISTS motivo_no_pagada,
  DROP COLUMN IF EXISTS no_pagada_en,
  DROP COLUMN IF EXISTS lista_en;

ALTER TABLE reencauche_llanta DROP CONSTRAINT reencauche_llanta_estado_check;
ALTER TABLE reencauche_llanta ADD CONSTRAINT reencauche_llanta_estado_check CHECK (
  estado IN ('Por enviar', 'En planta', 'Lista para entregar', 'Entregada', 'Rechazada en planta')
);
