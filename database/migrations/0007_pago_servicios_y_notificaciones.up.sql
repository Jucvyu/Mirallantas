-- =========================================================================
-- 0007 · Pago de los servicios de reencauche y notificaciones al cliente
--
--   · Un servicio pedido en una cotización ya no se cobra en ella: el
--     asesor le pone precio en "Solicitudes de servicio", el cliente lo paga
--     (con su comprobante) y el asesor aprueba o rechaza ese pago. Solo con
--     el pago aprobado el reencauche avanza a sus estados normales.
--   · Un abono rechazado guarda el motivo, para pedir que se vuelva a subir.
--   · Notificaciones para el cliente (precio asignado, pago aprobado o
--     rechazado, abono confirmado o rechazado, crédito aprobado o no).
-- =========================================================================

ALTER TABLE solicitud_servicio
  -- Valor total del servicio (todas las llantas); lo asigna el asesor
  ADD COLUMN precio           BIGINT CHECK (precio > 0),
  ADD COLUMN pago_estado      TEXT NOT NULL DEFAULT 'Sin precio'
             CHECK (pago_estado IN ('Sin precio', 'Por pagar', 'En revisión', 'Aprobado', 'Rechazado')),
  ADD COLUMN pago_medio       TEXT REFERENCES medio_pago (nombre) ON UPDATE CASCADE,
  ADD COLUMN pago_comprobante TEXT,
  ADD COLUMN pago_fecha       DATE,
  ADD COLUMN pago_motivo      TEXT;

-- Las solicitudes anteriores ya se cobraban dentro de su cotización: quedan pagadas
UPDATE solicitud_servicio SET pago_estado = 'Aprobado';

ALTER TABLE abono ADD COLUMN motivo_rechazo TEXT;

CREATE TABLE notificacion (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES cliente (id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  mensaje    TEXT NOT NULL,
  -- Pantalla del portal a la que lleva (p. ej. /portal/pedidos)
  enlace     TEXT,
  -- 'info' | 'exito' | 'alerta': el color con que se muestra
  tipo       TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'exito', 'alerta')),
  leida      BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notificacion_cliente ON notificacion (cliente_id, creado_en DESC);
