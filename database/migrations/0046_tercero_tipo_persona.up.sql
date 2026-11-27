-- =========================================================================
-- 0046 · Tercero (reencauchadora): persona natural o juridica
--
-- Los terceros usan el mismo formulario que los proveedores (0044): primero
-- el tipo de persona y, segun eso, sus datos. La persona juridica se
-- identifica con NIT. Los que ya existian con NIT quedan como juridicos; los
-- demas, como naturales.
-- =========================================================================

ALTER TABLE tercero ADD COLUMN tipo_persona TEXT NOT NULL DEFAULT 'Natural'
  CHECK (tipo_persona IN ('Natural', 'Jurídica'));

UPDATE tercero SET tipo_persona = 'Jurídica' WHERE tipo_documento = 'NIT';

ALTER TABLE tercero ADD CONSTRAINT tercero_juridica_con_nit
  CHECK (tipo_persona = 'Natural' OR tipo_documento = 'NIT');
