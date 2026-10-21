-- Revierte 0012: vuelve al enlace de un solo uso. Los códigos vigentes se anulan.
UPDATE recuperacion_password SET usado = TRUE WHERE NOT usado;
ALTER TABLE recuperacion_password RENAME COLUMN codigo_hash TO token_hash;
ALTER TABLE recuperacion_password
  DROP COLUMN intentos_restantes,
  DROP COLUMN verificado;
CREATE UNIQUE INDEX recuperacion_password_token ON recuperacion_password (token_hash);
DELETE FROM bloqueo_recuperacion;
