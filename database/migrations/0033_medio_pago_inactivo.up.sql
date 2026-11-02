-- =========================================================================
-- 0033 · Medios de pago que se pueden desactivar
--
-- El negocio dejó de aceptar pagos con tarjeta. En vez de borrar el medio
-- "Tarjeta" (lo referencian abonos y pagos antiguos), se marca inactivo:
-- deja de ofrecerse en los formularios, pero los registros que ya lo usaban
-- siguen siendo válidos.
-- =========================================================================

ALTER TABLE medio_pago ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE medio_pago SET activo = FALSE WHERE nombre = 'Tarjeta';
