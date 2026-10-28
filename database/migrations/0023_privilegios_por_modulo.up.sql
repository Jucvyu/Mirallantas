-- =========================================================================
-- 0023 · Nivel 3 de seguridad: privilegios por módulo
--
-- Hasta ahora un rol tenía o no tenía acceso a un módulo (nivel 1: la
-- sesión; nivel 2: el módulo). Ahora, dentro de cada módulo, el rol tiene
-- privilegios por acción: ver (tener la fila), crear, editar y eliminar.
--
-- Los roles existentes conservan todos sus privilegios (por defecto TRUE):
-- no cambia nada hasta que el Administrador los ajuste. El rol
-- Administrador siempre los tiene todos (un trigger lo garantiza).
-- =========================================================================

ALTER TABLE rol_permiso
  ADD COLUMN puede_crear    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN puede_editar   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN puede_eliminar BOOLEAN NOT NULL DEFAULT TRUE;

-- El Administrador no pierde privilegios: se fuerzan siempre a TRUE
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
