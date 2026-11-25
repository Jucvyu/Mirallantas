-- =========================================================================
-- 0044 · Proveedor: persona natural o jurídica
--
-- El formulario de proveedor pregunta primero si es persona natural o
-- jurídica y, según eso, pide sus datos:
--   · Natural: nombre completo y documento de persona (CC, CE, Pasaporte o
--     NIT); la persona de contacto es opcional.
--   · Jurídica: razón social, NIT y la persona de contacto (obligatoria).
-- Los proveedores que ya existían con NIT quedan como jurídicos; los demás,
-- como naturales (también los que se creen sin indicarlo, p. ej. desde otro
-- módulo).
-- =========================================================================

ALTER TABLE proveedor ADD COLUMN tipo_persona TEXT NOT NULL DEFAULT 'Natural'
  CHECK (tipo_persona IN ('Natural', 'Jurídica'));

UPDATE proveedor SET tipo_persona = 'Jurídica' WHERE tipo_documento = 'NIT';

-- La persona jurídica se identifica con NIT
ALTER TABLE proveedor ADD CONSTRAINT proveedor_juridica_con_nit
  CHECK (tipo_persona = 'Natural' OR tipo_documento = 'NIT');
