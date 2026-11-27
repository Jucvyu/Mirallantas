-- Cobrar una llanta reencauchada (al entregarla) es una venta: queda en
-- Ventas, de contado y completada, con una linea del servicio "Reencauche"
-- por el valor cobrado (banda + mano de obra). La venta queda ligada a la
-- llanta (una sola venta por llanta) y lleva la reencauchadora que la hizo.

ALTER TABLE venta ADD COLUMN reencauche_llanta_id INTEGER UNIQUE REFERENCES reencauche_llanta (id);

-- Crea la venta de una llanta entregada y devuelve su id. Si ya la tiene,
-- devuelve la que existe (no la duplica).
CREATE FUNCTION venta_de_reencauche(p_llanta INTEGER) RETURNS INTEGER AS $$
DECLARE
  v_id    INTEGER;
  v_l     RECORD;
  v_valor BIGINT;
BEGIN
  SELECT id INTO v_id FROM venta WHERE reencauche_llanta_id = p_llanta;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT l.id, l.identificador, l.medida, l.precio_banda, l.mano_obra, l.tercero_id, l.pago_fecha,
         l.pago_comprobante, r.cliente_id, r.numero, b.nombre AS banda
    INTO v_l
    FROM reencauche_llanta l
    JOIN reencauche r ON r.id = l.reencauche_id
    LEFT JOIN banda b ON b.id = l.banda_id
   WHERE l.id = p_llanta AND l.estado = 'Entregada';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solo se vende una llanta reencauchada entregada.';
  END IF;

  v_valor := COALESCE(v_l.precio_banda, 0) + COALESCE(v_l.mano_obra, 0);

  INSERT INTO venta (numero, cliente_id, tercero_id, fecha, metodo_pago, total, estado, estado_entrega,
                     comprobante_url, reencauche_llanta_id)
  VALUES (siguiente_numero('VEN'), v_l.cliente_id, v_l.tercero_id, COALESCE(v_l.pago_fecha, CURRENT_DATE),
          'Contado', v_valor, 'Completada', 'Entregado', v_l.pago_comprobante, v_l.id)
  RETURNING id INTO v_id;

  INSERT INTO venta_detalle (venta_id, tipo, servicio_id, descripcion, medida, cantidad, precio_unitario, subtotal)
  SELECT v_id, 'servicio', s.id,
         left(concat_ws(' · ', 'Reencauche ' || v_l.numero, v_l.banda, 'ID ' || v_l.identificador), 200),
         v_l.medida, 1, v_valor, v_valor
    FROM servicio s
   WHERE s.nombre = 'Reencauche'
   ORDER BY s.id
   LIMIT 1;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Las llantas que ya se cobraron pasan a Ventas, en el orden en que se pagaron
DO $$
DECLARE
  v_llanta INTEGER;
BEGIN
  FOR v_llanta IN
    SELECT id FROM reencauche_llanta WHERE estado = 'Entregada' ORDER BY pago_fecha, id
  LOOP
    PERFORM venta_de_reencauche(v_llanta);
  END LOOP;
END;
$$;
