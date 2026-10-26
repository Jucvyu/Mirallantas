-- =========================================================================
-- 0022 · Cotización cancelada: su entrega también
--
-- Cuando una cotización pasa a "Rechazada" (la cancela el asesor o el
-- cliente, o se rechaza su crédito), su entrega queda "Cancelado" sola.
-- Una entrega que ya se hizo ("Entregado") no se toca. Las cotizaciones
-- que ya estaban canceladas con la entrega pendiente también se corrigen.
-- =========================================================================

CREATE FUNCTION cotizacion_cancelar_entrega() RETURNS trigger AS $$
BEGIN
  IF NEW.estado_entrega NOT IN ('Entregado', 'Cancelado') THEN
    NEW.estado_entrega := 'Cancelado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cotizacion_cancelada_entrega
  BEFORE UPDATE OF estado ON cotizacion
  FOR EACH ROW WHEN (NEW.estado = 'Rechazada' AND OLD.estado <> 'Rechazada')
  EXECUTE FUNCTION cotizacion_cancelar_entrega();

UPDATE cotizacion SET estado_entrega = 'Cancelado'
 WHERE estado = 'Rechazada' AND estado_entrega NOT IN ('Entregado', 'Cancelado');
