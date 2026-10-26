-- Revierte 0021: quita los índices (los datos no cambian).
DROP INDEX IF EXISTS compra_cotizacion_idx;
DROP INDEX IF EXISTS compra_detalle_producto_idx;
DROP INDEX IF EXISTS credito_cotizacion_idx;
DROP INDEX IF EXISTS credito_venta_idx;
DROP INDEX IF EXISTS credito_cliente_idx;
DROP INDEX IF EXISTS cotizacion_detalle_solicitud_idx;
DROP INDEX IF EXISTS cotizacion_detalle_producto_idx;
DROP INDEX IF EXISTS solicitud_servicio_cliente_idx;
DROP INDEX IF EXISTS solicitud_credito_cliente_idx;
DROP INDEX IF EXISTS producto_categoria_idx;
DROP INDEX IF EXISTS producto_marca_idx;
DROP INDEX IF EXISTS producto_imagen_producto_idx;
