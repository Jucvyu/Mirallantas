-- Revierte 0044: el proveedor ya no distingue persona natural o jurídica.
ALTER TABLE proveedor
  DROP CONSTRAINT IF EXISTS proveedor_juridica_con_nit,
  DROP COLUMN IF EXISTS tipo_persona;
