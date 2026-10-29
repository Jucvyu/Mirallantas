-- =========================================================================
-- 0027 · El código del doble factor no se puede usar dos veces
--
-- Un código de 6 dígitos vale unos 90 segundos (su intervalo de 30 s y los
-- vecinos, por si el reloj del celular está desfasado). Se guarda el
-- intervalo del último código aceptado: uno igual o anterior se rechaza, así
-- quien lo vea en la pantalla no puede reutilizarlo para entrar.
-- =========================================================================

ALTER TABLE usuario ADD COLUMN totp_ultimo_paso BIGINT;
