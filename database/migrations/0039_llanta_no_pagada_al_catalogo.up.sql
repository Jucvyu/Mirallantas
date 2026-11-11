-- =========================================================================
-- 0039 · Llanta reencauchada que el cliente no pagó pasa al catálogo
--
--   · Nuevo estado de la orden: "No pagada". Lo marca el asesor (con el
--     precio de venta) o pasa solo a los 30 días de estar "Lista para
--     entregar" sin pago (`lista_en` guarda desde cuándo está lista).
--   · Al quedar "No pagada", la llanta entra al catálogo como producto
--     (`producto.reencauchada`): "Llanta reencauchada", marca "Sin marca",
--     categoría "Reencauchadas", sin imagen y de una sola unidad.
--     `reencauche_llanta.producto_id` liga la llanta con su producto.
--   · El ID de la llanta ya no se escribe: lo asigna el sistema con el
--     número de la solicitud y la posición (REE-2026-001-1).
-- =========================================================================

ALTER TABLE reencauche_llanta DROP CONSTRAINT reencauche_llanta_estado_check;
ALTER TABLE reencauche_llanta ADD CONSTRAINT reencauche_llanta_estado_check CHECK (
  estado IN ('Por enviar', 'En planta', 'Lista para entregar', 'Entregada', 'Rechazada en planta', 'No pagada')
);

ALTER TABLE reencauche_llanta
  ADD COLUMN lista_en DATE,
  ADD COLUMN no_pagada_en DATE,
  ADD COLUMN motivo_no_pagada TEXT,
  ADD COLUMN producto_id INTEGER UNIQUE REFERENCES producto (id) ON DELETE SET NULL,
  ADD CONSTRAINT reencauche_llanta_no_pagada CHECK ((COALESCE(estado, '') = 'No pagada') = (no_pagada_en IS NOT NULL));

-- Las que ya estaban listas cuentan desde que salieron a la planta
UPDATE reencauche_llanta SET lista_en = COALESCE(enviada_en, CURRENT_DATE) WHERE estado = 'Lista para entregar';

ALTER TABLE producto ADD COLUMN reencauchada BOOLEAN NOT NULL DEFAULT FALSE;

-- Marca y categoría de las llantas reencauchadas
INSERT INTO marca (nombre) VALUES ('Sin marca') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO categoria (nombre, descripcion, color)
VALUES ('Reencauchadas', 'Llantas reencauchadas que el cliente no reclamó. Unidad única.', '#64748B')
ON CONFLICT (nombre) DO NOTHING;
