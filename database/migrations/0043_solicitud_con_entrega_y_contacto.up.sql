-- =========================================================================
-- 0043 · Más datos en la solicitud de cotización
--
-- El cliente, al crear la solicitud desde su carro, indica:
--   · modo_entrega: 'Despacho' (se le lleva a una dirección) o 'Recoge'
--     (pasa por el local; entonces no hace falta dirección).
--   · telefono_contacto: a dónde llamarlo por esta solicitud (opcional; si
--     no lo da, se usa el de su ficha).
--   · fecha_requerida: para cuándo necesita las llantas (opcional).
--   · observaciones: notas para el asesor (opcional).
-- Las cotizaciones que ya existen quedan como 'Despacho', que es lo que eran.
-- =========================================================================

ALTER TABLE cotizacion
  ADD COLUMN modo_entrega TEXT NOT NULL DEFAULT 'Despacho'
    CONSTRAINT cotizacion_modo_entrega_valido CHECK (modo_entrega IN ('Despacho', 'Recoge')),
  ADD COLUMN telefono_contacto TEXT,
  ADD COLUMN fecha_requerida DATE,
  ADD COLUMN observaciones TEXT;
-- Que un despacho lleve dirección lo exige la API al crear la solicitud (una
-- restricción aquí haría fallar cualquier cambio de las cotizaciones viejas
-- que se crearon sin dirección).
