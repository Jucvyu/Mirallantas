-- Revierte 0017. Falla si alguna compra quedó sin proveedor: asígnaselo antes.
ALTER TABLE compra ALTER COLUMN proveedor_id SET NOT NULL;
