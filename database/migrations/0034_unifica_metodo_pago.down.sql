-- Revierte 0034: vuelve la tabla medio_pago con sus referencias.
CREATE TABLE medio_pago (
  nombre TEXT PRIMARY KEY,
  orden  INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO medio_pago (nombre, orden, activo)
SELECT nombre, orden, activo FROM metodo_pago WHERE tipo = 'medio';

ALTER TABLE venta DROP CONSTRAINT venta_metodo_pago_es_forma;
ALTER TABLE cotizacion DROP CONSTRAINT cotizacion_metodo_pago_es_forma;

ALTER TABLE solicitud_servicio
  DROP CONSTRAINT solicitud_servicio_pago_es_medio,
  DROP CONSTRAINT solicitud_servicio_pago_metodo_pago_fk,
  ADD CONSTRAINT solicitud_servicio_pago_medio_fkey FOREIGN KEY (pago_medio) REFERENCES medio_pago (nombre) ON UPDATE CASCADE;

ALTER TABLE cotizacion
  DROP CONSTRAINT cotizacion_cuota_inicial_es_medio,
  DROP CONSTRAINT cotizacion_cuota_inicial_metodo_pago_fk,
  ADD CONSTRAINT cotizacion_cuota_inicial_medio_fk FOREIGN KEY (cuota_inicial_medio) REFERENCES medio_pago (nombre) ON UPDATE CASCADE;

ALTER TABLE pago_cotizacion
  DROP CONSTRAINT pago_cotizacion_metodo_pago_es_medio,
  DROP CONSTRAINT pago_cotizacion_metodo_pago_fk;
ALTER TABLE pago_cotizacion RENAME COLUMN metodo_pago TO medio_pago;
ALTER TABLE pago_cotizacion
  ADD CONSTRAINT pago_cotizacion_medio_pago_fkey FOREIGN KEY (medio_pago) REFERENCES medio_pago (nombre) ON UPDATE CASCADE;

ALTER TABLE abono
  DROP CONSTRAINT abono_metodo_pago_es_medio,
  DROP CONSTRAINT abono_metodo_pago_fk;
ALTER TABLE abono RENAME COLUMN metodo_pago TO medio_pago;
ALTER TABLE abono
  ADD CONSTRAINT abono_medio_pago_fk FOREIGN KEY (medio_pago) REFERENCES medio_pago (nombre) ON UPDATE CASCADE;

DELETE FROM metodo_pago WHERE tipo = 'medio';
ALTER TABLE metodo_pago DROP COLUMN activo, DROP COLUMN tipo;
