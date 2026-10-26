-- =========================================================================
-- 0021 · Índices para que las consultas respondan más rápido
--
-- Columnas por las que se cruzan las tablas en los listados y en las
-- automatizaciones (compras y créditos de una cotización, líneas de un
-- reencauche, productos de una categoría, solicitudes de un cliente…).
-- Solo aceleran las consultas: no cambian ningún dato.
-- =========================================================================

CREATE INDEX IF NOT EXISTS compra_cotizacion_idx ON compra (cotizacion_id);
CREATE INDEX IF NOT EXISTS compra_detalle_producto_idx ON compra_detalle (producto_id);
CREATE INDEX IF NOT EXISTS credito_cotizacion_idx ON credito (cotizacion_id);
CREATE INDEX IF NOT EXISTS credito_venta_idx ON credito (venta_id);
CREATE INDEX IF NOT EXISTS credito_cliente_idx ON credito (cliente_id);
CREATE INDEX IF NOT EXISTS cotizacion_detalle_solicitud_idx ON cotizacion_detalle (solicitud_servicio_id);
CREATE INDEX IF NOT EXISTS cotizacion_detalle_producto_idx ON cotizacion_detalle (producto_id);
CREATE INDEX IF NOT EXISTS solicitud_servicio_cliente_idx ON solicitud_servicio (cliente_id);
CREATE INDEX IF NOT EXISTS solicitud_credito_cliente_idx ON solicitud_credito (cliente_id);
CREATE INDEX IF NOT EXISTS producto_categoria_idx ON producto (categoria_id);
CREATE INDEX IF NOT EXISTS producto_marca_idx ON producto (marca_id);
CREATE INDEX IF NOT EXISTS producto_imagen_producto_idx ON producto_imagen (producto_id);
