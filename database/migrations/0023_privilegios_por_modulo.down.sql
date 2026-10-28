-- Revierte 0023: los roles vuelven a tener acceso completo a sus módulos.
DROP TRIGGER IF EXISTS privilegios_admin_completos ON rol_permiso;
DROP FUNCTION IF EXISTS privilegios_admin_completos();
ALTER TABLE rol_permiso
  DROP COLUMN IF EXISTS puede_crear,
  DROP COLUMN IF EXISTS puede_editar,
  DROP COLUMN IF EXISTS puede_eliminar;
