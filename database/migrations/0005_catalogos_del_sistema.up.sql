-- =========================================================================
-- 0005 · Listas que estaban fijas en el código pasan a la base de datos
--
--   · tipo_documento  CC, CE, NIT, Pasaporte
--   · metodo_pago     Contado, Crédito (cómo se pacta el pago)
--   · medio_pago      Efectivo, Transferencia, Tarjeta (con qué se paga)
--   · tipo_vehiculo   se llena con los tipos con los que nació el sistema
--
-- Antes, cada columna tenía un CHECK con los valores escritos a mano. Ahora
-- apunta (llave foránea) a su tabla: la lista vive en un solo lugar y el
-- frontend la pide a la API (GET /api/referencias).
--
-- Además se quitan los permisos "Empresa" y "Seguridad": esos módulos ya
-- no están en el panel.
-- =========================================================================

-- ---- Tipos de documento ------------------------------------------------------
CREATE TABLE tipo_documento (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  orden  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO tipo_documento (codigo, nombre, orden) VALUES
  ('CC', 'Cédula de ciudadanía', 1),
  ('CE', 'Cédula de extranjería', 2),
  ('NIT', 'NIT', 3),
  ('Pasaporte', 'Pasaporte', 4);

-- ---- Métodos y medios de pago ---------------------------------------------------
CREATE TABLE metodo_pago (
  nombre TEXT PRIMARY KEY,
  orden  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO metodo_pago (nombre, orden) VALUES ('Contado', 1), ('Crédito', 2);

CREATE TABLE medio_pago (
  nombre TEXT PRIMARY KEY,
  orden  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO medio_pago (nombre, orden) VALUES ('Efectivo', 1), ('Transferencia', 2), ('Tarjeta', 3);

-- ---- Los CHECK escritos a mano se cambian por llaves foráneas ---------------------
-- ON UPDATE CASCADE: si un nombre se corrige en la tabla, se corrige en todos lados.
ALTER TABLE cliente   DROP CONSTRAINT IF EXISTS cliente_tipo_documento_check,
  ADD CONSTRAINT cliente_tipo_documento_fk FOREIGN KEY (tipo_documento) REFERENCES tipo_documento (codigo) ON UPDATE CASCADE;
ALTER TABLE usuario   DROP CONSTRAINT IF EXISTS usuario_tipo_documento_check,
  ADD CONSTRAINT usuario_tipo_documento_fk FOREIGN KEY (tipo_documento) REFERENCES tipo_documento (codigo) ON UPDATE CASCADE;
ALTER TABLE proveedor DROP CONSTRAINT IF EXISTS proveedor_tipo_documento_check,
  ADD CONSTRAINT proveedor_tipo_documento_fk FOREIGN KEY (tipo_documento) REFERENCES tipo_documento (codigo) ON UPDATE CASCADE;
ALTER TABLE tercero   DROP CONSTRAINT IF EXISTS tercero_tipo_documento_check,
  ADD CONSTRAINT tercero_tipo_documento_fk FOREIGN KEY (tipo_documento) REFERENCES tipo_documento (codigo) ON UPDATE CASCADE;

ALTER TABLE cotizacion DROP CONSTRAINT IF EXISTS cotizacion_metodo_pago_check,
  ADD CONSTRAINT cotizacion_metodo_pago_fk FOREIGN KEY (metodo_pago) REFERENCES metodo_pago (nombre) ON UPDATE CASCADE;
ALTER TABLE venta DROP CONSTRAINT IF EXISTS venta_metodo_pago_check,
  ADD CONSTRAINT venta_metodo_pago_fk FOREIGN KEY (metodo_pago) REFERENCES metodo_pago (nombre) ON UPDATE CASCADE;

ALTER TABLE abono DROP CONSTRAINT IF EXISTS abono_medio_pago_check,
  ADD CONSTRAINT abono_medio_pago_fk FOREIGN KEY (medio_pago) REFERENCES medio_pago (nombre) ON UPDATE CASCADE;
ALTER TABLE cotizacion DROP CONSTRAINT IF EXISTS cotizacion_cuota_inicial_medio_check,
  ADD CONSTRAINT cotizacion_cuota_inicial_medio_fk FOREIGN KEY (cuota_inicial_medio) REFERENCES medio_pago (nombre) ON UPDATE CASCADE;

-- ---- Tipos de vehículo base (no borra ni duplica los que ya existan) ---------------
INSERT INTO tipo_vehiculo (nombre) VALUES
  ('Turismo'), ('SUV / Camioneta'), ('Carga liviana'), ('Camión / Tracto'), ('Agrícola'), ('Industrial')
ON CONFLICT (nombre) DO NOTHING;

-- ---- Módulos retirados del panel ----------------------------------------------------
-- El trigger que protege los permisos del Administrador se apaga solo aquí
ALTER TABLE rol_permiso DISABLE TRIGGER permisos_admin_protegidos;
DELETE FROM rol_permiso WHERE permiso_id IN (SELECT id FROM permiso WHERE modulo IN ('Empresa', 'Seguridad'));
ALTER TABLE rol_permiso ENABLE TRIGGER permisos_admin_protegidos;
DELETE FROM permiso WHERE modulo IN ('Empresa', 'Seguridad');
