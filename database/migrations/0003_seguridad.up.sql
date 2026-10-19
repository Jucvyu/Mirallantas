-- =========================================================================
-- 0003 · Seguridad para producción
--
--   · Roles y permisos base: antes solo los creaba el seed de desarrollo; en
--     producción deben existir desde la primera migración.
--   · El rol Administrador queda blindado también en la base: no se puede
--     renombrar, desactivar, eliminar ni quitarle permisos.
--   · Sesiones: versión de sesión (cerrar sesión invalida los tokens),
--     bloqueo temporal por intentos fallidos y doble factor (TOTP).
--   · Bitácora de seguridad: inicios de sesión, bloqueos y accesos negados.
--   · Clave de idempotencia en abonos y cotizaciones: un doble clic o un
--     reintento de red no registra el mismo pago dos veces.
--
-- No borra datos existentes. Es segura sobre una base que ya tenga datos
-- (los INSERT usan ON CONFLICT DO NOTHING).
-- =========================================================================

-- ---- Permisos y roles base -------------------------------------------------
INSERT INTO permiso (modulo)
VALUES ('Roles'), ('Usuarios'), ('Empresa'), ('Seguridad'), ('Clientes'), ('Proveedores'),
       ('Terceros'), ('Productos'), ('Categorías'), ('Marcas'), ('Compras'),
       ('Pedidos-Cotización'), ('Ventas'), ('Solicitudes de servicio'), ('Cartera'),
       ('Abonos'), ('Dashboard')
ON CONFLICT (modulo) DO NOTHING;

INSERT INTO rol (nombre, descripcion)
VALUES ('Administrador', 'Acceso completo al aplicativo.'),
       ('Cliente', 'Portal: catálogo, cotizaciones y cartera.')
ON CONFLICT (nombre) DO NOTHING;

-- El Administrador tiene todos los módulos
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r CROSS JOIN permiso p WHERE r.nombre = 'Administrador'
ON CONFLICT DO NOTHING;

-- El Cliente solo ve sus cotizaciones y su cartera (la API filtra por cliente)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.modulo IN ('Pedidos-Cotización', 'Cartera')
 WHERE r.nombre = 'Cliente'
ON CONFLICT DO NOTHING;

-- ---- El rol Administrador no se toca ---------------------------------------
-- Segunda barrera, por si alguien edita la base o hay un error en la API.
CREATE FUNCTION proteger_rol_admin() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.nombre = 'Administrador' THEN
    RAISE EXCEPTION 'El rol Administrador no se puede eliminar.' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.nombre = 'Administrador'
     AND (NEW.nombre IS DISTINCT FROM OLD.nombre OR NEW.activo IS DISTINCT FROM OLD.activo
          OR NEW.descripcion IS DISTINCT FROM OLD.descripcion) THEN
    RAISE EXCEPTION 'El rol Administrador no se puede editar.' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rol_admin_protegido
  BEFORE UPDATE OR DELETE ON rol
  FOR EACH ROW EXECUTE FUNCTION proteger_rol_admin();

CREATE FUNCTION proteger_permisos_admin() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rol WHERE id = OLD.rol_id AND nombre = 'Administrador') THEN
    RAISE EXCEPTION 'Los permisos del rol Administrador no se pueden quitar.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER permisos_admin_protegidos
  BEFORE DELETE ON rol_permiso
  FOR EACH ROW EXECUTE FUNCTION proteger_permisos_admin();

-- ---- Sesiones, bloqueo y doble factor --------------------------------------
ALTER TABLE usuario
  -- Sube en cada cierre de sesión o cambio de contraseña: los tokens con
  -- una versión anterior dejan de servir
  ADD COLUMN version_sesion    INTEGER NOT NULL DEFAULT 0,
  -- Intentos fallidos seguidos y hasta cuándo queda bloqueada la cuenta
  ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN bloqueado_hasta   TIMESTAMPTZ,
  -- Doble factor: secreto TOTP cifrado (nunca en texto plano)
  ADD COLUMN totp_secreto      TEXT,
  ADD COLUMN totp_activo       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ultimo_acceso     TIMESTAMPTZ,
  ADD COLUMN ultima_ip         TEXT;

-- ---- Bitácora de seguridad -------------------------------------------------
CREATE TABLE evento_seguridad (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo       TEXT NOT NULL,
  -- Alta: requiere revisión (cuenta bloqueada, acceso desde IP nueva…)
  gravedad   TEXT NOT NULL DEFAULT 'Info' CHECK (gravedad IN ('Info', 'Alerta', 'Alta')),
  usuario_id INTEGER REFERENCES usuario (id) ON DELETE SET NULL,
  correo     TEXT,
  ip         TEXT,
  agente     TEXT,
  detalle    TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX evento_seguridad_fecha ON evento_seguridad (creado_en DESC);

-- ---- Pagos sin duplicados --------------------------------------------------
ALTER TABLE abono ADD COLUMN clave_idempotencia UUID UNIQUE;
ALTER TABLE cotizacion ADD COLUMN clave_idempotencia UUID UNIQUE;
