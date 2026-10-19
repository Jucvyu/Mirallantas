-- Revierte 0009
ALTER TABLE usuario DROP COLUMN IF EXISTS notificaciones_vistas_en;
DROP TABLE IF EXISTS notificacion_personal;
-- El trigger que protege los permisos del Administrador se apaga solo aquí
ALTER TABLE rol_permiso DISABLE TRIGGER permisos_admin_protegidos;
DELETE FROM rol_permiso WHERE permiso_id IN (SELECT id FROM permiso WHERE modulo IN ('Catálogo (portal)', 'Mis cotizaciones', 'Mi cartera'));
ALTER TABLE rol_permiso ENABLE TRIGGER permisos_admin_protegidos;
DELETE FROM permiso WHERE modulo IN ('Catálogo (portal)', 'Mis cotizaciones', 'Mi cartera');
