-- Revierte 0015: deja de anotar las imágenes soltadas (no toca Cloudinary).
DROP TRIGGER IF EXISTS usuario_imagenes ON usuario;
DROP TRIGGER IF EXISTS producto_imagen_imagenes ON producto_imagen;
DROP TRIGGER IF EXISTS solicitud_servicio_imagenes ON solicitud_servicio;
DROP TRIGGER IF EXISTS cotizacion_imagenes ON cotizacion;
DROP TRIGGER IF EXISTS venta_imagenes ON venta;
DROP TRIGGER IF EXISTS abono_imagenes ON abono;
DROP TRIGGER IF EXISTS pago_cotizacion_imagenes ON pago_cotizacion;
DROP FUNCTION IF EXISTS anotar_imagenes_soltadas();
DROP FUNCTION IF EXISTS imagen_en_uso(TEXT);
DROP TABLE IF EXISTS imagen_por_borrar;
