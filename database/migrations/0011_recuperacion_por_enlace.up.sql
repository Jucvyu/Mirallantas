-- =========================================================================
-- 0011 · Recuperación de contraseña por enlace y precio verificado sin costo
--
--   · recuperacion_password guarda ahora la huella (HMAC) del token de un
--     enlace de un solo uso, en vez de un código de 6 dígitos. Los códigos
--     que estuvieran vigentes se anulan. Ya no hay intentos por código ni
--     paso de verificación.
--   · Al emitir una cotización el asesor deja de escribir el costo del
--     proveedor: basta con el proveedor y la fecha en que verificó el
--     precio. Los costos ya registrados se conservan.
-- =========================================================================

UPDATE recuperacion_password SET usado = TRUE WHERE NOT usado;
ALTER TABLE recuperacion_password RENAME COLUMN codigo_hash TO token_hash;
ALTER TABLE recuperacion_password
  DROP COLUMN intentos_restantes,
  DROP COLUMN verificado;
CREATE UNIQUE INDEX recuperacion_password_token ON recuperacion_password (token_hash);

-- Las esperas por IP se reinician con la regla nueva (5 enlaces, 15 minutos)
DELETE FROM bloqueo_recuperacion;

ALTER TABLE cotizacion_detalle DROP CONSTRAINT cotizacion_detalle_costo_completo;
ALTER TABLE cotizacion_detalle ADD CONSTRAINT cotizacion_detalle_verificacion_con_proveedor
  CHECK (costo_confirmado_en IS NULL OR proveedor_id IS NOT NULL);
