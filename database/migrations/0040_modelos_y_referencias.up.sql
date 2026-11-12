-- =========================================================================
-- 0040 · Catálogo por modelos y referencias
--
-- Antes había una fila de `producto` por cada marca + nombre + medida (la
-- misma Michelin repetida muchas veces) y no había ficha técnica. Ahora:
--
--   · modelo_llanta: la llanta como producto (marca, nombre, categoría,
--     tipo de vehículo) con su ficha técnica, copiada a mano de la página
--     del fabricante o del proveedor. Sus fotos van en modelo_imagen.
--   · producto: sigue siendo la REFERENCIA que se vende (una medida de un
--     modelo). Conserva su id, su código ML-… y las llaves foráneas de
--     cotizaciones, ventas, compras y reencauches. Sus columnas nombre,
--     descripcion, categoria_id, marca_id y tipo_vehiculo_id pasan a ser
--     COPIA del modelo, mantenida por triggers: así todo lo que ya leía esas
--     columnas sigue funcionando igual.
--   · La llanta reencauchada (producto.reencauchada) es una unidad única:
--     no se agrupa por medida y su descripción y su tipo de vehículo son
--     propios (no se copian del modelo).
--   · Precio y stock siguen fuera del catálogo. No hay índice de velocidad.
--
-- Pasos: (0) revisar que los datos se puedan agrupar sin perder nada,
-- (1) crear los modelos, (2) enlazar cada producto con su modelo, (3) pasar
-- las fotos al modelo y (4) crear los triggers.
--
-- Para poder revertir sin perder datos, los nombres y descripciones
-- originales y las fotos que se movieron quedan en dos tablas de respaldo
-- (migracion_0040_producto y migracion_0040_imagen); el .down las usa.
-- =========================================================================

-- ---- (0) Revisión previa ---------------------------------------------------
DO $$
DECLARE
  v_conflicto TEXT;
BEGIN
  -- Mismo producto (marca + nombre) con distinta categoría o tipo de vehículo
  SELECT string_agg(format('%s / %s', m.nombre, g.nombre), '; ')
    INTO v_conflicto
    FROM (
      SELECT p.marca_id, min(btrim(p.nombre)) AS nombre
        FROM producto p
       WHERE NOT p.reencauchada
       GROUP BY p.marca_id, lower(btrim(p.nombre))
      HAVING count(DISTINCT p.categoria_id) > 1
          OR count(DISTINCT COALESCE(p.tipo_vehiculo_id, 0)) > 1
    ) g
    JOIN marca m ON m.id = g.marca_id;
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede agrupar el catálogo: estos productos tienen la misma marca y nombre pero distinta categoría o tipo de vehículo: %. Corrígelos (cambia el nombre o iguala la categoría y el tipo) y vuelve a migrar.', v_conflicto;
  END IF;

  -- Productos repetidos: misma marca, nombre y medida
  SELECT string_agg(format('%s / %s / %s', m.nombre, g.nombre, g.medidas), '; ')
    INTO v_conflicto
    FROM (
      SELECT p.marca_id, min(btrim(p.nombre)) AS nombre, p.medidas
        FROM producto p
       WHERE NOT p.reencauchada
       GROUP BY p.marca_id, lower(btrim(p.nombre)), p.medidas
      HAVING count(*) > 1
    ) g
    JOIN marca m ON m.id = g.marca_id;
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede agrupar el catálogo: hay productos repetidos (misma marca, nombre y medida): %. Desactiva o renombra los sobrantes y vuelve a migrar.', v_conflicto;
  END IF;
END;
$$;

-- ---- Tablas nuevas ---------------------------------------------------------
CREATE TABLE modelo_llanta (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  categoria_id     INTEGER NOT NULL REFERENCES categoria (id),
  marca_id         INTEGER NOT NULL REFERENCES marca (id),
  tipo_vehiculo_id INTEGER REFERENCES tipo_vehiculo (id),
  -- Ficha técnica (todo opcional: se llena a medida que se consulta)
  uso              TEXT,
  posicion         TEXT CHECK (posicion IN ('Direccional', 'Tracción', 'Cualquier posición')),
  labrado          TEXT,
  construccion     TEXT CHECK (construccion IN ('Radial', 'Diagonal')),
  sin_camara       BOOLEAN,
  garantia_meses   SMALLINT CHECK (garantia_meses BETWEEN 0 AND 240),
  pais_origen      TEXT,
  recauchable      BOOLEAN,
  -- De dónde se copió la ficha (página del fabricante o del proveedor)
  fuente_ficha     TEXT,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una marca no repite nombre de producto (sin importar mayúsculas)
CREATE UNIQUE INDEX modelo_llanta_marca_nombre_unico ON modelo_llanta (marca_id, lower(nombre));
CREATE INDEX modelo_llanta_categoria_idx ON modelo_llanta (categoria_id);

CREATE TABLE modelo_imagen (
  id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modelo_id INTEGER NOT NULL REFERENCES modelo_llanta (id) ON DELETE CASCADE,
  url       TEXT NOT NULL,
  orden     SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX modelo_imagen_modelo_idx ON modelo_imagen (modelo_id);

-- La foto que se cambia o se borra se anota para limpiarla de Cloudinary
CREATE TRIGGER modelo_imagen_imagenes AFTER UPDATE OR DELETE ON modelo_imagen
  FOR EACH ROW EXECUTE FUNCTION anotar_imagenes_soltadas('url');

-- Una foto del modelo está en uso: la limpieza no la borra
CREATE OR REPLACE FUNCTION imagen_en_uso(direccion TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM usuario WHERE foto_url = direccion)
      OR EXISTS (SELECT 1 FROM producto_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM modelo_imagen WHERE url = direccion)
      OR EXISTS (SELECT 1 FROM solicitud_servicio
                 WHERE foto_url = direccion OR pago_comprobante = direccion OR direccion = ANY (fotos))
      OR EXISTS (SELECT 1 FROM cotizacion WHERE cuota_inicial_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM venta WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM abono WHERE comprobante_url = direccion)
      OR EXISTS (SELECT 1 FROM pago_cotizacion WHERE comprobante = direccion)
      OR EXISTS (SELECT 1 FROM reencauche_llanta WHERE pago_comprobante = direccion)
      OR EXISTS (SELECT 1 FROM empresa WHERE logo_url = direccion);
$$ LANGUAGE sql STABLE;

-- ---- Respaldo para el .down ------------------------------------------------
CREATE TABLE migracion_0040_producto (
  producto_id INTEGER PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT
);
INSERT INTO migracion_0040_producto (producto_id, nombre, descripcion)
SELECT id, nombre, descripcion FROM producto;

CREATE TABLE migracion_0040_imagen (
  producto_id INTEGER NOT NULL,
  url         TEXT NOT NULL,
  orden       SMALLINT NOT NULL
);

-- ---- (1) Modelos: uno por marca + nombre -----------------------------------
-- Los datos del modelo salen del primer producto del grupo (el de menor id
-- que no sea reencauchada). La descripción es la primera que no esté vacía.
INSERT INTO modelo_llanta (nombre, descripcion, categoria_id, marca_id, tipo_vehiculo_id, activo)
SELECT DISTINCT ON (p.marca_id, lower(btrim(p.nombre)))
       btrim(p.nombre),
       -- La reencauchada lleva su propia descripción: el modelo no
       CASE WHEN p.reencauchada THEN NULL ELSE (
         SELECT d.descripcion FROM producto d
          WHERE d.marca_id = p.marca_id AND lower(btrim(d.nombre)) = lower(btrim(p.nombre))
            AND NOT d.reencauchada AND COALESCE(btrim(d.descripcion), '') <> ''
          ORDER BY d.id LIMIT 1)
       END,
       p.categoria_id,
       p.marca_id,
       CASE WHEN p.reencauchada THEN NULL ELSE p.tipo_vehiculo_id END,
       -- Activo si alguna de sus referencias lo está
       EXISTS (SELECT 1 FROM producto a
                WHERE a.marca_id = p.marca_id AND lower(btrim(a.nombre)) = lower(btrim(p.nombre)) AND a.activo)
  FROM producto p
 ORDER BY p.marca_id, lower(btrim(p.nombre)), p.reencauchada, p.id;

-- ---- (2) Cada producto (referencia) con su modelo --------------------------
ALTER TABLE producto
  ADD COLUMN modelo_id           INTEGER REFERENCES modelo_llanta (id),
  ADD COLUMN indice_carga        TEXT CONSTRAINT producto_indice_carga_formato
                                      CHECK (indice_carga ~ '^[0-9]{2,3}(/[0-9]{2,3})?$'),
  ADD COLUMN lonas               SMALLINT CONSTRAINT producto_lonas_rango CHECK (lonas BETWEEN 1 AND 40),
  ADD COLUMN profundidad_labrado NUMERIC(4, 1) CONSTRAINT producto_profundidad_rango
                                      CHECK (profundidad_labrado > 0 AND profundidad_labrado <= 50),
  ADD COLUMN peso_kg             NUMERIC(6, 2) CONSTRAINT producto_peso_rango
                                      CHECK (peso_kg > 0 AND peso_kg <= 2000),
  ADD COLUMN codigo_fabricante   TEXT,
  -- Partes de la medida, para buscar y ordenar: 295/80R22.5 = 295 · 80 · 22.5
  -- (100/90/17 de moto = 100 · 90 · 17; 7.50R16 = 7.50 · sin perfil · 16)
  ADD COLUMN ancho  NUMERIC GENERATED ALWAYS AS (
    substring(medidas FROM '^([0-9]+(?:\.[0-9]+)?)')::numeric) STORED,
  ADD COLUMN perfil NUMERIC GENERATED ALWAYS AS (
    substring(medidas FROM '^[0-9]+(?:\.[0-9]+)?/([0-9]+(?:\.[0-9]+)?)')::numeric) STORED,
  ADD COLUMN rin    NUMERIC GENERATED ALWAYS AS (
    COALESCE(
      substring(medidas FROM '[A-Z-]([0-9]{2}(?:\.[0-9]+)?)C?$'),
      substring(medidas FROM '^[0-9.]+/[0-9.]+/([0-9]{2}(?:\.[0-9]+)?)$')
    )::numeric) STORED;

UPDATE producto p
   SET modelo_id = ml.id
  FROM modelo_llanta ml
 WHERE ml.marca_id = p.marca_id AND lower(ml.nombre) = lower(btrim(p.nombre));

ALTER TABLE producto ALTER COLUMN modelo_id SET NOT NULL;
CREATE INDEX producto_modelo_idx ON producto (modelo_id);

-- Una medida (con su índice de carga) no se repite en el mismo modelo
CREATE UNIQUE INDEX producto_referencia_unica ON producto (modelo_id, medidas, COALESCE(indice_carga, ''))
  WHERE NOT reencauchada;

-- Las copias quedan iguales al modelo (la reencauchada conserva lo suyo)
UPDATE producto p
   SET nombre = ml.nombre,
       descripcion = CASE WHEN p.reencauchada THEN p.descripcion ELSE ml.descripcion END
  FROM modelo_llanta ml
 WHERE ml.id = p.modelo_id;

-- ---- (3) Fotos: del producto al modelo -------------------------------------
-- El modelo se queda con las fotos de su primer producto que tenga alguna
INSERT INTO modelo_imagen (modelo_id, url, orden)
SELECT p.modelo_id, i.url, i.orden
  FROM producto_imagen i
  JOIN producto p ON p.id = i.producto_id
 WHERE p.id = (
   SELECT min(q.id) FROM producto q
    WHERE q.modelo_id = p.modelo_id AND EXISTS (SELECT 1 FROM producto_imagen qi WHERE qi.producto_id = q.id))
 ORDER BY i.orden, i.id;

-- En el producto solo quedan las fotos distintas a las del modelo
INSERT INTO migracion_0040_imagen (producto_id, url, orden)
SELECT i.producto_id, i.url, i.orden
  FROM producto_imagen i JOIN producto p ON p.id = i.producto_id
 WHERE EXISTS (SELECT 1 FROM modelo_imagen mi WHERE mi.modelo_id = p.modelo_id AND mi.url = i.url);

DELETE FROM producto_imagen i
 USING producto p
 WHERE p.id = i.producto_id
   AND EXISTS (SELECT 1 FROM modelo_imagen mi WHERE mi.modelo_id = p.modelo_id AND mi.url = i.url);

-- Esas fotos no se soltaron: siguen en uso en el modelo
DELETE FROM imagen_por_borrar b WHERE EXISTS (SELECT 1 FROM modelo_imagen mi WHERE mi.url = b.url);

-- ---- (4) Triggers ----------------------------------------------------------

-- Antes de guardar una referencia: toma los datos de su modelo. Si llega sin
-- modelo (los INSERT de antes, las pruebas, la llanta reencauchada), lo busca
-- por marca + nombre y, si no existe, lo crea.
CREATE FUNCTION producto_desde_modelo() RETURNS trigger AS $$
DECLARE
  m modelo_llanta%ROWTYPE;
BEGIN
  IF NEW.modelo_id IS NULL THEN
    SELECT * INTO m FROM modelo_llanta
     WHERE marca_id = NEW.marca_id AND lower(nombre) = lower(btrim(NEW.nombre));
    IF NOT FOUND THEN
      INSERT INTO modelo_llanta (nombre, descripcion, categoria_id, marca_id, tipo_vehiculo_id)
      VALUES (btrim(NEW.nombre),
              CASE WHEN NEW.reencauchada THEN NULL ELSE NEW.descripcion END,
              NEW.categoria_id, NEW.marca_id,
              CASE WHEN NEW.reencauchada THEN NULL ELSE NEW.tipo_vehiculo_id END)
      RETURNING * INTO m;
    END IF;
    NEW.modelo_id := m.id;
  ELSE
    SELECT * INTO m FROM modelo_llanta WHERE id = NEW.modelo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto seleccionado no existe.';
    END IF;
  END IF;

  NEW.nombre := m.nombre;
  NEW.categoria_id := m.categoria_id;
  NEW.marca_id := m.marca_id;
  -- La reencauchada es una unidad única: su descripción y su vehículo son suyos
  IF NOT NEW.reencauchada THEN
    NEW.descripcion := m.descripcion;
    NEW.tipo_vehiculo_id := m.tipo_vehiculo_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER producto_copia_modelo
  BEFORE INSERT OR UPDATE ON producto
  FOR EACH ROW EXECUTE FUNCTION producto_desde_modelo();

-- Al cambiar el modelo, sus referencias se vuelven a copiar
CREATE FUNCTION modelo_sincronizar_referencias() RETURNS trigger AS $$
BEGIN
  UPDATE producto SET modelo_id = modelo_id WHERE modelo_id = NEW.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER modelo_llanta_sincroniza
  AFTER UPDATE OF nombre, descripcion, categoria_id, marca_id, tipo_vehiculo_id ON modelo_llanta
  FOR EACH ROW
  WHEN (OLD.nombre IS DISTINCT FROM NEW.nombre
     OR OLD.descripcion IS DISTINCT FROM NEW.descripcion
     OR OLD.categoria_id IS DISTINCT FROM NEW.categoria_id
     OR OLD.marca_id IS DISTINCT FROM NEW.marca_id
     OR OLD.tipo_vehiculo_id IS DISTINCT FROM NEW.tipo_vehiculo_id)
  EXECUTE FUNCTION modelo_sincronizar_referencias();

-- Desactivar una categoría desactiva sus modelos (sus productos ya se
-- desactivaban, migración 0019). Reactivarla no los reactiva.
CREATE FUNCTION categoria_desactivar_modelos() RETURNS trigger AS $$
BEGIN
  UPDATE modelo_llanta SET activo = FALSE WHERE categoria_id = NEW.id AND activo;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categoria_inactiva_modelos
  AFTER UPDATE OF activo ON categoria
  FOR EACH ROW WHEN (OLD.activo AND NOT NEW.activo)
  EXECUTE FUNCTION categoria_desactivar_modelos();
