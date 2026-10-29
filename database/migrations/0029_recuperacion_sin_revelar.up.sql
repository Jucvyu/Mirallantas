-- =========================================================================
-- 0029 · "¿Olvidaste tu contraseña?" no revela qué correos existen
--
-- Antes, con un correo sin cuenta se respondía "No hay ninguna cuenta con
-- ese correo": así cualquiera podía averiguar quién es cliente. Ahora la
-- respuesta es la misma exista o no la cuenta. Si no existe (o está
-- inactiva) se guarda igual una solicitud, sin usuario y con un código que
-- no se envía a nadie: se comporta como cualquier otra (3 intentos, vence
-- a los 10 minutos) y nunca llega a cambiar una contraseña.
-- =========================================================================

ALTER TABLE recuperacion_password ALTER COLUMN usuario_id DROP NOT NULL;
