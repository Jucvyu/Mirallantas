-- =========================================================================
-- 0004 · Recuperar la contraseña con un código enviado al correo
--
--   · recuperacion_password: cada solicitud guarda el código (solo su
--     hash, nunca el código), cuántos intentos le quedan y si ya se
--     verificó. Vence a los 10 minutos.
--   · bloqueo_recuperacion: intentos por IP de buscar un correo que no
--     existe. Al agotar 5, la IP espera 2 minutos.
-- =========================================================================

CREATE TABLE recuperacion_password (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id         INTEGER NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  codigo_hash        TEXT NOT NULL,
  intentos_restantes INTEGER NOT NULL DEFAULT 3 CHECK (intentos_restantes >= 0),
  verificado         BOOLEAN NOT NULL DEFAULT FALSE,
  usado              BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en          TIMESTAMPTZ NOT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recuperacion_password_usuario ON recuperacion_password (usuario_id);

CREATE TABLE bloqueo_recuperacion (
  ip                 TEXT PRIMARY KEY,
  intentos_restantes INTEGER NOT NULL DEFAULT 5,
  bloqueado_hasta    TIMESTAMPTZ
);
