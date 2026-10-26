-- =========================================================================
-- 0020 · Avisos por módulo en el menú lateral
--
-- Cada módulo del menú muestra una burbuja con los avisos nuevos que llevan
-- a él (como en WhatsApp). Aquí se guarda cuándo vio cada usuario cada
-- módulo: al entrar, su burbuja vuelve a cero.
--
-- No borra datos existentes.
-- =========================================================================

CREATE TABLE notificacion_vista_ruta (
  usuario_id INTEGER NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  ruta       TEXT NOT NULL,
  visto_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, ruta)
);
