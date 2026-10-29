-- =========================================================================
-- 0026 · Límite de peticiones a la API con un cubo de fichas
--
-- Cada usuario (o cada IP, si no ha iniciado sesión) tiene un cubo con
-- fichas. Cada petición gasta una; el cubo se rellena solo a un ritmo fijo
-- (p. ej. 100 por minuto) sin pasar de su capacidad. Si está vacío, la
-- petición se rechaza con 429. Es el algoritmo "token bucket" que usan
-- Amazon API Gateway y Stripe: permite ráfagas cortas y frena el abuso
-- sostenido.
--
-- No hace falta un proceso que rellene los cubos: se guardan las fichas que
-- quedaron y la hora de la última recarga, y en cada petición se suman las
-- que se ganaron desde entonces.
-- =========================================================================

CREATE TABLE cubo_fichas (
  -- 'u:<id del usuario>' o 'ip:<dirección>'
  clave          TEXT PRIMARY KEY,
  fichas         DOUBLE PRECISION NOT NULL,
  ultima_recarga TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Para borrar los cubos que llevan tiempo sin usarse (ya estarían llenos)
CREATE INDEX cubo_fichas_recarga_idx ON cubo_fichas (ultima_recarga);

-- Recarga el cubo según el tiempo pasado y, si hay al menos una ficha, la
-- gasta. Devuelve si la petición se permite y cuántas fichas quedan. El
-- bloqueo de la fila (FOR UPDATE) evita que dos peticiones simultáneas del
-- mismo usuario gasten la misma ficha.
CREATE FUNCTION consumir_ficha(p_clave TEXT, p_capacidad INTEGER, p_por_segundo DOUBLE PRECISION)
RETURNS TABLE (permitida BOOLEAN, fichas DOUBLE PRECISION) AS $$
DECLARE
  ahora    TIMESTAMPTZ := clock_timestamp();
  actuales DOUBLE PRECISION;
  recarga  TIMESTAMPTZ;
BEGIN
  INSERT INTO cubo_fichas (clave, fichas, ultima_recarga) VALUES (p_clave, p_capacidad, ahora)
  ON CONFLICT (clave) DO NOTHING;

  SELECT c.fichas, c.ultima_recarga INTO actuales, recarga
    FROM cubo_fichas c WHERE c.clave = p_clave FOR UPDATE;

  actuales := LEAST(p_capacidad, actuales + GREATEST(0, EXTRACT(EPOCH FROM ahora - recarga)) * p_por_segundo);
  permitida := actuales >= 1;
  IF permitida THEN actuales := actuales - 1; END IF;

  UPDATE cubo_fichas c SET fichas = actuales, ultima_recarga = ahora WHERE c.clave = p_clave;
  fichas := actuales;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
