-- =========================================================================
-- 0030 · Aviso de crédito vencido
--
-- Un crédito está vencido cuando pasó su fecha límite y todavía tiene saldo.
-- Para no repetir el aviso, se guarda el día en que ya se avisó (al cliente
-- y al personal de cartera). Queda NULL mientras no se haya avisado.
-- =========================================================================

ALTER TABLE credito ADD COLUMN aviso_vencido_en DATE;
