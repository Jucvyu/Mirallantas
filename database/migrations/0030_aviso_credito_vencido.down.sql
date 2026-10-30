-- Revierte 0030: deja de recordarse si ya se avisó de un crédito vencido.
ALTER TABLE credito DROP COLUMN IF EXISTS aviso_vencido_en;
