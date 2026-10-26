-- Revierte 0022 (las entregas que ya quedaron canceladas siguen así).
DROP TRIGGER IF EXISTS cotizacion_cancelada_entrega ON cotizacion;
DROP FUNCTION IF EXISTS cotizacion_cancelar_entrega();
