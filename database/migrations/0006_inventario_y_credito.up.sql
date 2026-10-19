-- =========================================================================
-- 0006 · Inventario automático y crédito por solicitud
--
--   · Las cuentas que no tienen rol Cliente se desligan de cualquier ficha
--     de cliente (un cliente al que hicieron Administrador seguía viendo
--     solo sus datos y la API lo trataba como del portal).
--   · El total de una cotización lo calcula siempre el servidor (precio del
--     catálogo × cantidad): ya no hay que "confirmar el valor".
--   · Cada compra recuerda si ya sumó su mercancía al stock, para hacerlo
--     una sola vez (al quedar Recibida y Entregada).
--   · Una cotización a crédito genera su solicitud de crédito: se liga aquí.
-- =========================================================================

UPDATE usuario u
   SET cliente_id = NULL
  FROM rol r
 WHERE r.id = u.rol_id AND r.nombre <> 'Cliente' AND u.cliente_id IS NOT NULL;

UPDATE cotizacion SET confirmado = TRUE WHERE NOT confirmado;
ALTER TABLE cotizacion ALTER COLUMN confirmado SET DEFAULT TRUE;

ALTER TABLE compra ADD COLUMN stock_aplicado BOOLEAN NOT NULL DEFAULT FALSE;
-- Las compras que ya estaban recibidas y entregadas no se vuelven a sumar
UPDATE compra SET stock_aplicado = TRUE WHERE estado = 'Recibida' AND estado_entrega = 'Entregado';

ALTER TABLE solicitud_credito
  ADD COLUMN cotizacion_id INTEGER UNIQUE REFERENCES cotizacion (id) ON DELETE CASCADE;
