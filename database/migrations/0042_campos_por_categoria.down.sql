-- Revierte 0042: las categorías vuelven a pedir todos los datos.
ALTER TABLE categoria DROP COLUMN IF EXISTS campos_ocultos;
