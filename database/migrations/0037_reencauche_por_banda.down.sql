-- Revierte 0037 (borra las bandas y los reencauches: solo en desarrollo)
DROP TABLE IF EXISTS reencauche_llanta;
DROP TABLE IF EXISTS reencauche;
DROP TABLE IF EXISTS banda_medida;
DROP TABLE IF EXISTS banda;
DROP FUNCTION IF EXISTS siguiente_codigo_banda();
DROP SEQUENCE IF EXISTS banda_codigo_seq;
DROP TABLE IF EXISTS diseno_banda;
DELETE FROM consecutivo WHERE prefijo = 'REE';

-- El trigger que protege los permisos del Administrador se apaga solo aquí
ALTER TABLE rol_permiso DISABLE TRIGGER permisos_admin_protegidos;
DELETE FROM rol_permiso WHERE permiso_id IN (SELECT id FROM permiso WHERE modulo IN ('Reencauche', 'Mis reencauches'));
ALTER TABLE rol_permiso ENABLE TRIGGER permisos_admin_protegidos;
DELETE FROM notificacion_personal WHERE modulo = 'Reencauche';
DELETE FROM permiso WHERE modulo IN ('Reencauche', 'Mis reencauches');

