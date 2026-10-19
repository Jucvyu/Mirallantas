-- Revierte 0003. Los roles y permisos base se conservan (otros datos dependen de ellos).
ALTER TABLE cotizacion DROP COLUMN IF EXISTS clave_idempotencia;
ALTER TABLE abono DROP COLUMN IF EXISTS clave_idempotencia;

DROP TABLE IF EXISTS evento_seguridad;

ALTER TABLE usuario
  DROP COLUMN IF EXISTS ultima_ip,
  DROP COLUMN IF EXISTS ultimo_acceso,
  DROP COLUMN IF EXISTS totp_activo,
  DROP COLUMN IF EXISTS totp_secreto,
  DROP COLUMN IF EXISTS bloqueado_hasta,
  DROP COLUMN IF EXISTS intentos_fallidos,
  DROP COLUMN IF EXISTS version_sesion;

DROP TRIGGER IF EXISTS permisos_admin_protegidos ON rol_permiso;
DROP FUNCTION IF EXISTS proteger_permisos_admin();
DROP TRIGGER IF EXISTS rol_admin_protegido ON rol;
DROP FUNCTION IF EXISTS proteger_rol_admin();
