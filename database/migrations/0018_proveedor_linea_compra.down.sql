-- Revierte 0018: se pierde el proveedor de las líneas adicionales.
ALTER TABLE compra_detalle DROP COLUMN IF EXISTS proveedor_id;
