-- Revierte 0005: vuelven los CHECK y los permisos Empresa y Seguridad.
INSERT INTO permiso (modulo) VALUES ('Empresa'), ('Seguridad') ON CONFLICT (modulo) DO NOTHING;
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.modulo IN ('Empresa', 'Seguridad') WHERE r.nombre = 'Administrador'
ON CONFLICT DO NOTHING;

ALTER TABLE cotizacion DROP CONSTRAINT IF EXISTS cotizacion_cuota_inicial_medio_fk,
  ADD CONSTRAINT cotizacion_cuota_inicial_medio_check CHECK (cuota_inicial_medio IN ('Efectivo', 'Transferencia', 'Tarjeta'));
ALTER TABLE abono DROP CONSTRAINT IF EXISTS abono_medio_pago_fk,
  ADD CONSTRAINT abono_medio_pago_check CHECK (medio_pago IN ('Efectivo', 'Transferencia', 'Tarjeta'));
ALTER TABLE venta DROP CONSTRAINT IF EXISTS venta_metodo_pago_fk,
  ADD CONSTRAINT venta_metodo_pago_check CHECK (metodo_pago IN ('Contado', 'Crédito'));
ALTER TABLE cotizacion DROP CONSTRAINT IF EXISTS cotizacion_metodo_pago_fk,
  ADD CONSTRAINT cotizacion_metodo_pago_check CHECK (metodo_pago IN ('Contado', 'Crédito'));
ALTER TABLE tercero DROP CONSTRAINT IF EXISTS tercero_tipo_documento_fk,
  ADD CONSTRAINT tercero_tipo_documento_check CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte'));
ALTER TABLE proveedor DROP CONSTRAINT IF EXISTS proveedor_tipo_documento_fk,
  ADD CONSTRAINT proveedor_tipo_documento_check CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte'));
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_tipo_documento_fk,
  ADD CONSTRAINT usuario_tipo_documento_check CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte'));
ALTER TABLE cliente DROP CONSTRAINT IF EXISTS cliente_tipo_documento_fk,
  ADD CONSTRAINT cliente_tipo_documento_check CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte'));

DROP TABLE IF EXISTS medio_pago;
DROP TABLE IF EXISTS metodo_pago;
DROP TABLE IF EXISTS tipo_documento;
