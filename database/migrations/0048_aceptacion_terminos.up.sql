-- Quien se registra desde la pagina debe aceptar los terminos y condiciones.
-- Se guarda cuando los acepto. Las cuentas que ya existen (o las que crea el
-- personal desde el panel) quedan sin fecha.
ALTER TABLE usuario ADD COLUMN terminos_aceptados_en TIMESTAMPTZ;
