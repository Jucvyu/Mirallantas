-- =========================================================================
-- 0045 · Reencauche: varias bandas en una solicitud y fecha por confirmar
--
--   · Una solicitud lleva una o varias líneas (`reencauche_item`), como un
--     carro: cada una con su banda, la medida de esas llantas y cuántas.
--     `reencauche.banda_id` y `reencauche.medida` quedan con la primera línea
--     (para los listados) y `reencauche.cantidad` es el total de llantas.
--   · Si el asesor agenda la revisión en un día distinto al que prefirió el
--     cliente, la solicitud queda "Por confirmar" (en amarillo) hasta que el
--     cliente acepte la fecha en el portal (o el asesor anote que la aceptó
--     por teléfono). Entonces pasa a "Agendada".
--   · El motivo de cancelación ya era obligatorio en la base; ahora también
--     lo pide el portal al cliente.
-- =========================================================================

CREATE TABLE reencauche_item (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reencauche_id INTEGER NOT NULL REFERENCES reencauche (id) ON DELETE CASCADE,
  posicion      SMALLINT NOT NULL CHECK (posicion > 0),
  banda_id      INTEGER NOT NULL REFERENCES banda (id),
  medida        TEXT NOT NULL CHECK (medida <> ''),
  cantidad      SMALLINT NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  CONSTRAINT reencauche_item_posicion UNIQUE (reencauche_id, posicion),
  -- La misma banda con la misma medida va en una sola línea (se suman)
  CONSTRAINT reencauche_item_unico UNIQUE (reencauche_id, banda_id, medida)
);
CREATE INDEX reencauche_item_banda ON reencauche_item (banda_id);

-- Las solicitudes que ya existían quedan con su única línea
INSERT INTO reencauche_item (reencauche_id, posicion, banda_id, medida, cantidad)
SELECT id, 1, banda_id, medida, cantidad FROM reencauche;

-- Estado nuevo: la fecha que propuso el asesor espera la confirmación del cliente
ALTER TABLE reencauche DROP CONSTRAINT reencauche_estado_check;
ALTER TABLE reencauche ADD CONSTRAINT reencauche_estado_check CHECK (
  estado IN ('Por agendar', 'Por confirmar', 'Agendada', 'Cotizada', 'Aceptada', 'No aceptada', 'Sin llantas aptas', 'Cancelada')
);
ALTER TABLE reencauche ADD COLUMN fecha_confirmada_en TIMESTAMPTZ;
