-- Revierte 0026: la API deja de llevar la cuenta de fichas por usuario.
DROP FUNCTION IF EXISTS consumir_ficha(TEXT, INTEGER, DOUBLE PRECISION);
DROP TABLE IF EXISTS cubo_fichas;
