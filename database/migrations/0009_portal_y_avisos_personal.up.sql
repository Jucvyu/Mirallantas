-- =========================================================================
-- 0009 · Permisos de la vista de cliente y avisos para el personal
--
--   · Tres permisos nuevos para las pantallas del portal: "Catálogo
--     (portal)", "Mis cotizaciones" y "Mi cartera". Así un rol del
--     personal (p. ej. Asesor de Ventas) solo ve el botón "Portal del
--     cliente" si se le da alguno. Los tienen el Cliente y el Administrador.
--   · notificacion_personal: avisos del módulo Pedidos-Cotización
--     (cotización nueva desde el portal, pago vuelto a subir). Los ve quien
--     tenga permiso del módulo; cada usuario guarda hasta cuándo los vio.
-- =========================================================================

INSERT INTO permiso (modulo)
VALUES ('Catálogo (portal)'), ('Mis cotizaciones'), ('Mi cartera')
ON CONFLICT (modulo) DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.modulo IN ('Catálogo (portal)', 'Mis cotizaciones', 'Mi cartera')
 WHERE r.nombre IN ('Administrador', 'Cliente')
ON CONFLICT DO NOTHING;

CREATE TABLE notificacion_personal (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Módulo (permiso) que hay que tener para verla
  modulo    TEXT NOT NULL,
  titulo    TEXT NOT NULL,
  mensaje   TEXT NOT NULL,
  enlace    TEXT,
  tipo      TEXT NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'exito', 'alerta')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notificacion_personal_modulo ON notificacion_personal (modulo, creado_en DESC);

-- Hasta cuándo vio el usuario los avisos (lo de después cuenta como "sin leer")
ALTER TABLE usuario ADD COLUMN notificaciones_vistas_en TIMESTAMPTZ NOT NULL DEFAULT now();
