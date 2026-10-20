-- =========================================================================
-- 0010 · Solicitud de cotización, precios confirmados con el proveedor,
--        código automático de productos y retiro del stock
--
--   · Código del producto: lo genera la base (ML-000001, ML-000002…) con
--     una secuencia; la restricción UNIQUE que ya existía sigue siendo la
--     garantía final. Los productos existentes conservan su código.
--   · El stock deja de existir en el negocio: se borran producto.stock y
--     compra.stock_aplicado. Las cantidades de cotizaciones, ventas y
--     compras (unidades de cada operación) no se tocan.
--   · Cotización en dos etapas:
--       1. Solicitud: el cliente (o el asesor) pide productos y cantidades,
--          sin precios. Todavía no hay método de pago (metodo_pago NULL).
--       2. Cotización formal: el asesor confirma con el proveedor el costo
--          de cada llanta, fija el precio de venta y la emite. Vence a los
--          8 días calendario (vence_en = emitida_en + 8).
--     Después el cliente la acepta eligiendo contado o crédito.
--   · Cada línea guarda el proveedor, el costo confirmado, cuándo y quién
--     lo confirmó. Es dato interno: nunca se envía al portal.
-- =========================================================================

-- ---- Código automático de productos --------------------------------------
CREATE SEQUENCE producto_codigo_seq;

-- Siguiente código libre: ML- + 6 dígitos. Si alguno ya existe (códigos que
-- se escribieron a mano antes de este cambio), salta al siguiente.
CREATE FUNCTION siguiente_codigo_producto() RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  LOOP
    v_codigo := 'ML-' || LPAD(nextval('producto_codigo_seq')::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM producto WHERE codigo = v_codigo);
  END LOOP;
  RETURN v_codigo;
END;
$$;

ALTER TABLE producto ALTER COLUMN codigo SET DEFAULT siguiente_codigo_producto();

-- ---- Sin stock ------------------------------------------------------------
ALTER TABLE producto DROP COLUMN stock;
ALTER TABLE compra DROP COLUMN stock_aplicado;

-- ---- Cotización: solicitud y cotización formal ----------------------------
-- El método de pago se elige al aceptar la cotización formal
ALTER TABLE cotizacion ALTER COLUMN metodo_pago DROP NOT NULL;
ALTER TABLE cotizacion
  ADD COLUMN emitida_en DATE,
  ADD COLUMN vence_en   DATE,
  ADD CONSTRAINT cotizacion_vigencia CHECK (vence_en IS NULL OR vence_en >= emitida_en);

-- Las cotizaciones que ya existían se tratan como emitidas el día que se
-- crearon (ya tienen precio y método de pago)
UPDATE cotizacion SET emitida_en = fecha, vence_en = fecha + 8 WHERE confirmado;

ALTER TABLE cotizacion_detalle
  ADD COLUMN proveedor_id         INTEGER REFERENCES proveedor (id),
  ADD COLUMN costo_proveedor      BIGINT CHECK (costo_proveedor >= 0),
  ADD COLUMN costo_confirmado_en  TIMESTAMPTZ,
  ADD COLUMN costo_confirmado_por INTEGER REFERENCES usuario (id),
  -- Un costo solo cuenta como confirmado si tiene proveedor, valor y fecha
  ADD CONSTRAINT cotizacion_detalle_costo_completo CHECK (
    costo_confirmado_en IS NULL OR (proveedor_id IS NOT NULL AND costo_proveedor IS NOT NULL)
  );
