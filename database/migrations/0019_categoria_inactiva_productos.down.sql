-- Revierte 0019 (los productos que ya se desactivaron siguen así).
DROP TRIGGER IF EXISTS categoria_inactiva_productos ON categoria;
DROP FUNCTION IF EXISTS categoria_desactivar_productos();
