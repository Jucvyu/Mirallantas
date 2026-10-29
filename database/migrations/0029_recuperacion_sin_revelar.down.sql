-- Revierte 0029: las solicitudes sin cuenta se borran y el usuario vuelve a ser obligatorio.
DELETE FROM recuperacion_password WHERE usuario_id IS NULL;
ALTER TABLE recuperacion_password ALTER COLUMN usuario_id SET NOT NULL;
