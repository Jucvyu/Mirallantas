-- =========================================================================
-- 0025 · Nivel 3 de seguridad: todas las acciones de cada módulo
--
-- En vez de tres privilegios fijos (crear, editar, eliminar), cada módulo
-- tiene su propia lista de acciones (ver detalle, cambiar estado, anular,
-- emitir, revisar pago…; el catálogo está en backend/src/privilegios.js).
-- Se guarda la lista de las acciones NEGADAS: lo que no esté en ella está
-- permitido, así una acción nueva queda permitida hasta que se niegue.
--
-- Lo que ya estaba configurado con 0023 se conserva.
-- =========================================================================

ALTER TABLE rol_permiso ADD COLUMN acciones_denegadas TEXT[] NOT NULL DEFAULT '{}';

UPDATE rol_permiso
   SET acciones_denegadas = array_remove(ARRAY[
         CASE WHEN NOT puede_crear THEN 'crear' END,
         CASE WHEN NOT puede_editar THEN 'editar' END,
         CASE WHEN NOT puede_eliminar THEN 'eliminar' END
       ], NULL);

DROP TRIGGER IF EXISTS privilegios_admin_completos ON rol_permiso;
DROP FUNCTION IF EXISTS privilegios_admin_completos();
ALTER TABLE rol_permiso
  DROP COLUMN puede_crear,
  DROP COLUMN puede_editar,
  DROP COLUMN puede_eliminar;

-- El Administrador no tiene acciones negadas: se fuerza siempre
CREATE FUNCTION acciones_admin_completas() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rol WHERE id = NEW.rol_id AND nombre = 'Administrador') THEN
    NEW.acciones_denegadas := '{}';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acciones_admin_completas
  BEFORE INSERT OR UPDATE ON rol_permiso
  FOR EACH ROW EXECUTE FUNCTION acciones_admin_completas();
