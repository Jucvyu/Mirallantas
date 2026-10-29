-- =========================================================================
-- 0028 · El bloqueo por contraseñas erradas es por cuenta y por IP
--
-- Antes, 5 contraseñas erradas bloqueaban la cuenta para todos: cualquiera
-- que conociera un correo podía dejar a su dueño sin entrar. Ahora los 5
-- intentos son de cada IP: quien se equivoca (o ataca) queda bloqueado él,
-- y el dueño, desde su propia conexión, sigue entrando.
--
-- Los contadores de la tabla usuario siguen sirviendo como tope general
-- (más alto) contra un ataque repartido entre muchas IP.
-- =========================================================================

CREATE TABLE bloqueo_inicio (
  usuario_id        INTEGER NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  -- IP (las IPv6 agrupadas por su red /56)
  ip                TEXT NOT NULL,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, ip)
);

CREATE INDEX bloqueo_inicio_actualizado_idx ON bloqueo_inicio (actualizado_en);

-- Los bloqueos vigentes eran de la cuenta entera: se levantan
UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL;
