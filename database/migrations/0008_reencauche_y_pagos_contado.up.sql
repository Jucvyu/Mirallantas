-- =========================================================================
-- 0008 · Un solo servicio ("Reencauche") y pagos de las cotizaciones de contado
--
--   · El negocio ofrece un solo tipo de servicio: "Reencauche". Su valor lo
--     asigna el asesor en cada solicitud, así que el precio de catálogo es 0.
--   · Medio de pago "Otro" (además de efectivo, transferencia y tarjeta).
--   · pago_cotizacion: cada consignación que sube el cliente para pagar una
--     cotización de contado. El asesor la aprueba o la rechaza; si la
--     rechaza, el cliente sube otra y quedan todas como historial.
-- =========================================================================

INSERT INTO servicio (nombre, descripcion, precio)
VALUES ('Reencauche', 'Reencauche de llantas. El valor se define en cada solicitud.', 0)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO medio_pago (nombre, orden) VALUES ('Otro', 4) ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE pago_cotizacion (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id INTEGER NOT NULL REFERENCES cotizacion (id) ON DELETE CASCADE,
  monto         BIGINT NOT NULL CHECK (monto > 0),
  medio_pago    TEXT NOT NULL REFERENCES medio_pago (nombre) ON UPDATE CASCADE,
  comprobante   TEXT,
  estado        TEXT NOT NULL DEFAULT 'En revisión' CHECK (estado IN ('En revisión', 'Aprobado', 'Rechazado')),
  motivo        TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revisado_en   TIMESTAMPTZ
);
CREATE INDEX pago_cotizacion_cotizacion ON pago_cotizacion (cotizacion_id, creado_en DESC);
