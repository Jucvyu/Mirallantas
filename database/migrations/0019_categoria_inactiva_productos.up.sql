-- =========================================================================
-- 0019 · Categoría inactiva → sus productos también
--
-- Al desactivar una categoría se desactivan los productos asociados a ella
-- (desde la tabla, el formulario o cualquier otro camino: lo hace la base).
-- Reactivarla no reactiva los productos: cada uno se activa a mano, porque
-- algunos pudieron estar inactivos desde antes.
-- =========================================================================

CREATE FUNCTION categoria_desactivar_productos() RETURNS trigger AS $$
BEGIN
  UPDATE producto SET activo = FALSE WHERE categoria_id = NEW.id AND activo;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categoria_inactiva_productos
  AFTER UPDATE OF activo ON categoria
  FOR EACH ROW WHEN (OLD.activo AND NOT NEW.activo)
  EXECUTE FUNCTION categoria_desactivar_productos();
