-- =========================================================================
-- 0035 · Todo abono confirmado cuenta como venta
--
-- Una venta a crédito vale lo cobrado: la suma de los abonos confirmados de
-- su crédito. Había créditos con abonos confirmados y sin venta (p. ej. una
-- cotización con un reencauche aún sin precio), así que ese dinero no se veía
-- en Ventas ni en el tablero. Aquí se les crea la venta que les faltaba y se
-- recalcula el total de todas las ventas a crédito.
--
-- El total ahora puede quedar por debajo de la cuota inicial pactada (si se
-- rechaza esa cuota), por eso se retira la restricción que lo impedía.
-- =========================================================================

ALTER TABLE venta DROP CONSTRAINT venta_cuota_no_supera_total;

DO $$
DECLARE
  cr RECORD;
  nueva INTEGER;
BEGIN
  FOR cr IN
    SELECT c.id, c.cliente_id, c.cotizacion_id
      FROM credito c
     WHERE c.venta_id IS NULL
       AND EXISTS (SELECT 1 FROM abono a WHERE a.credito_id = c.id AND a.estado = 'Confirmado')
     ORDER BY c.id
  LOOP
    IF cr.cotizacion_id IS NULL THEN
      -- Crédito suelto (de una solicitud sin cotización): venta sin líneas
      INSERT INTO venta (numero, cliente_id, metodo_pago, total, estado)
      VALUES (siguiente_numero('VEN'), cr.cliente_id, 'Crédito', 0, 'Completada')
      RETURNING id INTO nueva;
    ELSE
      INSERT INTO venta (numero, cliente_id, cotizacion_id, proveedor_id, metodo_pago,
                         interes, total, cuota_inicial, estado, estado_entrega)
      SELECT siguiente_numero('VEN'), co.cliente_id, co.id, co.proveedor_id, 'Crédito',
             co.interes, 0, co.cuota_inicial,
             CASE co.estado WHEN 'Completada' THEN 'Completada' WHEN 'Rechazada' THEN 'Anulada' ELSE 'Pendiente' END,
             co.estado_entrega
        FROM cotizacion co
       WHERE co.id = cr.cotizacion_id
      RETURNING id INTO nueva;

      INSERT INTO venta_detalle (venta_id, tipo, producto_id, servicio_id, descripcion, medida,
                                 cantidad, precio_unitario, subtotal)
      SELECT nueva, tipo, producto_id, servicio_id, descripcion, medida, cantidad, precio_unitario, subtotal
        FROM cotizacion_detalle
       WHERE cotizacion_id = cr.cotizacion_id AND precio_unitario IS NOT NULL;
    END IF;
    UPDATE credito SET venta_id = nueva WHERE id = cr.id;
  END LOOP;
END $$;

UPDATE venta v
   SET total = COALESCE((
         SELECT SUM(a.monto) FROM abono a
          WHERE a.credito_id = cr.id AND a.estado = 'Confirmado'
       ), 0)
  FROM credito cr
 WHERE cr.venta_id = v.id;
