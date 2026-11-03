-- =========================================================================
-- 0034 · Una sola tabla de métodos de pago
--
-- metodo_pago y medio_pago guardaban casi lo mismo, así que medio_pago
-- desaparece y sus filas pasan a metodo_pago. La columna `tipo` conserva la
-- diferencia que sí importa al negocio:
--   · forma   Contado, Crédito: cómo se pacta una cotización o una venta
--   · medio   Efectivo, Transferencia…: con qué se paga un abono o una cuota
-- =========================================================================

ALTER TABLE metodo_pago
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'forma' CHECK (tipo IN ('forma', 'medio')),
  ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO metodo_pago (nombre, orden, tipo, activo)
SELECT nombre, orden, 'medio', activo FROM medio_pago;

-- ---- Las referencias a medio_pago pasan a metodo_pago ----
ALTER TABLE abono DROP CONSTRAINT abono_medio_pago_fk;
ALTER TABLE abono RENAME COLUMN medio_pago TO metodo_pago;
ALTER TABLE abono
  ADD CONSTRAINT abono_metodo_pago_fk FOREIGN KEY (metodo_pago) REFERENCES metodo_pago (nombre) ON UPDATE CASCADE,
  ADD CONSTRAINT abono_metodo_pago_es_medio CHECK (metodo_pago NOT IN ('Contado', 'Crédito'));

ALTER TABLE pago_cotizacion DROP CONSTRAINT pago_cotizacion_medio_pago_fkey;
ALTER TABLE pago_cotizacion RENAME COLUMN medio_pago TO metodo_pago;
ALTER TABLE pago_cotizacion
  ADD CONSTRAINT pago_cotizacion_metodo_pago_fk FOREIGN KEY (metodo_pago) REFERENCES metodo_pago (nombre) ON UPDATE CASCADE,
  ADD CONSTRAINT pago_cotizacion_metodo_pago_es_medio CHECK (metodo_pago NOT IN ('Contado', 'Crédito'));

ALTER TABLE cotizacion DROP CONSTRAINT cotizacion_cuota_inicial_medio_fk;
ALTER TABLE cotizacion
  ADD CONSTRAINT cotizacion_cuota_inicial_metodo_pago_fk FOREIGN KEY (cuota_inicial_medio) REFERENCES metodo_pago (nombre) ON UPDATE CASCADE,
  ADD CONSTRAINT cotizacion_cuota_inicial_es_medio CHECK (cuota_inicial_medio NOT IN ('Contado', 'Crédito'));

ALTER TABLE solicitud_servicio DROP CONSTRAINT solicitud_servicio_pago_medio_fkey;
ALTER TABLE solicitud_servicio
  ADD CONSTRAINT solicitud_servicio_pago_metodo_pago_fk FOREIGN KEY (pago_medio) REFERENCES metodo_pago (nombre) ON UPDATE CASCADE,
  ADD CONSTRAINT solicitud_servicio_pago_es_medio CHECK (pago_medio NOT IN ('Contado', 'Crédito'));

-- ---- Una cotización o una venta solo se pacta de contado o a crédito ----
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_metodo_pago_es_forma CHECK (metodo_pago IN ('Contado', 'Crédito'));
ALTER TABLE venta ADD CONSTRAINT venta_metodo_pago_es_forma CHECK (metodo_pago IN ('Contado', 'Crédito'));

DROP TABLE medio_pago;
