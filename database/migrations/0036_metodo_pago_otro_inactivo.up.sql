-- =========================================================================
-- 0036 · El método de pago "Otro" ya no se ofrece
--
-- Igual que "Tarjeta" (0033): se marca inactivo en vez de borrarlo, porque lo
-- pueden referenciar pagos antiguos, que siguen siendo válidos.
-- =========================================================================

UPDATE metodo_pago SET activo = FALSE WHERE nombre = 'Otro';
