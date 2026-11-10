-- =========================================================================
-- 0038 · Reencauche: ID de la llanta y comprobante del cobro
--
--   · En la revisión, cada llanta se identifica con su ID (el que el negocio
--     marca en la llanta para seguirla hasta la planta y de vuelta) en vez
--     del DOT. Letras, números y guiones; no se repite dentro de una misma
--     solicitud.
--   · Al entregar y cobrar por transferencia se guarda el pantallazo de la
--     consignación (pago_comprobante), igual que en los demás pagos.
-- =========================================================================

ALTER TABLE reencauche_llanta DROP CONSTRAINT IF EXISTS reencauche_llanta_dot_check;
ALTER TABLE reencauche_llanta RENAME COLUMN dot TO identificador;
ALTER TABLE reencauche_llanta
  ADD CONSTRAINT reencauche_llanta_identificador_formato CHECK (identificador ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  ADD CONSTRAINT reencauche_llanta_identificador_unico UNIQUE (reencauche_id, identificador);

ALTER TABLE reencauche_llanta ADD COLUMN pago_comprobante TEXT;

-- La imagen del comprobante se borra de Cloudinary cuando ya nadie la usa
CREATE TRIGGER reencauche_llanta_imagenes AFTER UPDATE OR DELETE ON reencauche_llanta
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('pago_comprobante');

CREATE OR REPLACE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE foto_url = direccion)
      OR EXISTS (SELECT 1 FROM producto_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM solicitud_servicio
                 WHERE foto_url = direccion OR pago_comprobante = direccion OR direccion = ANY (fotos))
      OR EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM venta WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM abono WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM pago_cotizacion WHERE comprobante = direccion)
      OR EXISTS (SELECT 1 FROM reencauche_llanta WHERE pago_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM empresa WHERE logo_url = direccion);
$$ LANGUAGE sql STABLE;
