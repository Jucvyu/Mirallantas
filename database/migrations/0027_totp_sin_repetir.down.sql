-- Revierte 0027: el código del doble factor vuelve a aceptarse mientras esté vigente.
ALTER TABLE usuario DROP COLUMN IF EXISTS totp_ultimo_paso;
