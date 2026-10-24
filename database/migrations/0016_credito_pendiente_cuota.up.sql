-- =========================================================================
-- 0016 · Crédito pendiente de la cuota inicial
--
--   · solicitud_credito: nuevo estado "Pendiente de cuota inicial". Al
--     aprobar la solicitud de una cotización con cuota inicial queda así, y
--     pasa sola a "Aprobada" cuando se confirma el pago de la cuota.
--   · credito.iniciado: el crédito (la cartera) no empieza hasta que se paga
--     la cuota inicial. Mientras tanto no recibe abonos y su plazo no corre:
--     las fechas de apertura y límite se fijan el día del pago.
--
-- Los créditos ya abiertos cuya cuota inicial sigue sin pagar quedan
-- pendientes (y sus solicitudes, en el estado nuevo).
-- =========================================================================

ALTER TABLE solicitud_credito DROP CONSTRAINT solicitud_credito_estado_check;
ALTER TABLE solicitud_credito ADD CONSTRAINT solicitud_credito_estado_check
  CHECK (estado IN ('Pendiente', 'Pendiente de cuota inicial', 'Aprobada', 'Rechazada'));

ALTER TABLE credito ADD COLUMN iniciado BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE credito cr
   SET iniciado = FALSE
  FROM cotizacion c
 WHERE c.id = cr.cotizacion_id
   AND c.cuota_inicial > 0
   AND c.estado = 'Pendiente'
   AND NOT EXISTS (SELECT 1 FROM abono a WHERE a.credito_id = cr.id AND a.estado = 'Confirmado');

UPDATE solicitud_credito s
   SET estado = 'Pendiente de cuota inicial'
  FROM credito cr
 WHERE cr.cotizacion_id = s.cotizacion_id
   AND NOT cr.iniciado
   AND s.estado = 'Aprobada';
