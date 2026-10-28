-- Revierte 0025: vuelve a los tres privilegios fijos de 0023.
DROP TRIGGER IF EXISTS acciones_admin_completas ON rol_permiso;
DROP FUNCTION IF EXISTS acciones_admin_completas();
ALTER TABLE rol_permiso
  ADD COLUMN puede_crear    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN puede_editar   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN puede_eliminar BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE rol_permiso
   SET puede_crear = NOT ('crear' = ANY (acciones_denegadas)),
       puede_editar = NOT ('editar' = ANY (acciones_denegadas)),
       puede_eliminar = NOT ('eliminar' = ANY (acciones_denegadas));
ALTER TABLE rol_permiso DROP COLUMN acciones_denegadas;

CREATE FUNCTION privilegios_admin_completos() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rol WHERE id = NEW.rol_id AND nombre = 'Administrador') THEN
    NEW.puede_crear := TRUE;
    NEW.puede_editar := TRUE;
    NEW.puede_eliminar := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER privilegios_admin_completos
  BEFORE INSERT OR UPDATE ON rol_permiso
  FOR EACH ROW EXECUTE FUNCTION privilegios_admin_completos();
