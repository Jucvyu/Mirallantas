-- =========================================================================
-- 0012 · Vuelve la recuperación de contraseña por código de 6 dígitos
--
--   · recuperacion_password guarda otra vez la huella (HMAC) del código, con
--     sus intentos y el paso de verificación (como en 0004). Los enlaces
--     que estuvieran vigentes se anulan.
--   · El correo sale por la API HTTPS de Brevo: Render gratis bloquea SMTP.
-- =========================================================================

DROP INDEX IF EXISTS recuperacion_password_token;
UPDATE recuperacion_password SET usado = TRUE WHERE NOT usado;
ALTER TABLE recuperacion_password RENAME COLUMN token_hash TO codigo_hash;
ALTER TABLE recuperacion_password
  ADD COLUMN intentos_restantes INTEGER NOT NULL DEFAULT 3 CHECK (intentos_restantes >= 0),
  ADD COLUMN verificado BOOLEAN NOT NULL DEFAULT FALSE;

-- Las esperas por IP se reinician con la regla de códigos (5 correos, 2 minutos)
DELETE FROM bloqueo_recuperacion;
