-- Revierte 0046: los terceros vuelven a no llevar tipo de persona.
ALTER TABLE tercero DROP CONSTRAINT IF EXISTS tercero_juridica_con_nit;
ALTER TABLE tercero DROP COLUMN IF EXISTS tipo_persona;
