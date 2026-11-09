-- =========================================================================
-- 0037 · Reencauche por banda
--
-- El reencauche deja de pedirse como un servicio suelto con la foto de la
-- carcasa. Sin ver la llanta no se puede saber si sirve, así que ahora:
--
--   1. La banda es un producto del catálogo de reencauche (tabla `banda`).
--      Se elige por diseño (direccional, tracción o mixta), tipo de vehículo
--      y ancho, y guarda las medidas de llanta con las que es compatible.
--      No se vende sola: siempre va con el servicio de reencauche.
--   2. El cliente pide el reencauche (tabla `reencauche`): la banda, la
--      medida de sus llantas, cuántas y dónde revisarlas. La revisión es gratis.
--   3. El asesor revisa cada llanta en persona (`reencauche_llanta`): DOT,
--      reencauches previos y si es apta. A las aptas les asigna la banda y el
--      valor (banda + mano de obra); con eso queda la cotización.
--   4. El cliente acepta sin pagar. Cada llanta apta es una orden para la
--      reencauchadora (Por enviar, luego En planta, luego Lista para entregar).
--   5. Solo se cobra cuando la reencauchadora entrega la llanta terminada.
--      Una llanta que la planta rechaza no se cobra.
--
-- Permisos nuevos: "Reencauche" (bandas, revisiones y órdenes; lo reciben el
-- Administrador y los roles que ya tenían "Solicitudes de servicio") y "Mis
-- reencauches" para el portal. "Solicitudes de servicio" sigue igual para
-- terminar los servicios del flujo anterior.
--
-- Las solicitudes de servicio anteriores (solicitud_servicio) se conservan
-- como historial: siguen visibles en sus cotizaciones.
-- =========================================================================

-- ---- Permisos ------------------------------------------------------------
INSERT INTO permiso (modulo) VALUES ('Reencauche'), ('Mis reencauches') ON CONFLICT (modulo) DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.modulo IN ('Reencauche', 'Mis reencauches')
 WHERE r.nombre = 'Administrador'
ON CONFLICT DO NOTHING;

-- Quien manejaba los servicios de reencauche maneja también el nuevo módulo
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT rp.rol_id, nuevo.id
  FROM rol_permiso rp
  JOIN permiso viejo ON viejo.id = rp.permiso_id AND viejo.modulo = 'Solicitudes de servicio'
  CROSS JOIN permiso nuevo
 WHERE nuevo.modulo = 'Reencauche'
ON CONFLICT DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r JOIN permiso p ON p.modulo = 'Mis reencauches'
 WHERE r.nombre = 'Cliente'
ON CONFLICT DO NOTHING;

-- ---- Diseños de banda ----------------------------------------------------
-- Vive en una tabla (y no en un CHECK) para poder sumar otro diseño, como
-- "Arrastre", sin tocar el código.
CREATE TABLE diseno_banda (
  nombre      TEXT PRIMARY KEY,
  descripcion TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 0
);
INSERT INTO diseno_banda (nombre, descripcion, orden) VALUES
  ('Direccional', 'Eje delantero, el que gira.', 1),
  ('Tracción', 'Ejes que llevan la fuerza del motor.', 2),
  ('Mixta', 'Vías destapadas y recorrido urbano.', 3);

-- ---- Bandas --------------------------------------------------------------
-- Código BAN-0001, BAN-0002… Si alguno ya existe (por ejemplo, después de
-- restaurar un respaldo), salta al siguiente.
CREATE SEQUENCE banda_codigo_seq;

CREATE FUNCTION siguiente_codigo_banda() RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  LOOP
    v_codigo := 'BAN-' || LPAD(nextval('banda_codigo_seq')::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM banda WHERE codigo = v_codigo);
  END LOOP;
  RETURN v_codigo;
END;
$$;

CREATE TABLE banda (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo           TEXT NOT NULL DEFAULT siguiente_codigo_banda(),
  nombre           TEXT NOT NULL,
  diseno           TEXT NOT NULL REFERENCES diseno_banda (nombre) ON UPDATE CASCADE,
  tipo_vehiculo_id INTEGER NOT NULL REFERENCES tipo_vehiculo (id),
  -- Ancho de la banda en milímetros (no el de la llanta)
  ancho_mm         SMALLINT NOT NULL CHECK (ancho_mm BETWEEN 100 AND 400),
  profundidad_mm   NUMERIC(4, 1) NOT NULL CHECK (profundidad_mm > 0 AND profundidad_mm <= 30),
  -- Precio de venta de la banda. Solo lo ve el personal: sugiere el valor
  -- en la revisión; el cliente ve el valor después de que revisan su llanta.
  precio           BIGINT NOT NULL CHECK (precio > 0),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT banda_codigo_unico UNIQUE (codigo),
  CONSTRAINT banda_nombre_unico UNIQUE (nombre)
);

-- Medidas de llanta con las que la banda es compatible (295/80R22.5…)
CREATE TABLE banda_medida (
  banda_id INTEGER NOT NULL REFERENCES banda (id) ON DELETE CASCADE,
  medida   TEXT NOT NULL CHECK (medida <> ''),
  PRIMARY KEY (banda_id, medida)
);
CREATE INDEX banda_medida_medida ON banda_medida (medida);

-- ---- Solicitud de reencauche ---------------------------------------------
CREATE TABLE reencauche (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- REE-AAAA-NNN
  numero             TEXT NOT NULL UNIQUE,
  cliente_id         INTEGER NOT NULL REFERENCES cliente (id),
  -- La banda que eligió el cliente; el asesor confirma la de cada llanta
  banda_id           INTEGER NOT NULL REFERENCES banda (id),
  medida             TEXT NOT NULL,
  cantidad           SMALLINT NOT NULL CHECK (cantidad BETWEEN 1 AND 20),
  -- Dónde se revisan las llantas: en el local o donde el cliente
  lugar              TEXT NOT NULL CHECK (lugar IN ('Local', 'Cliente')),
  direccion          TEXT,
  fecha_preferida    DATE NOT NULL,
  fecha_revision     DATE,
  notas              TEXT,
  estado             TEXT NOT NULL DEFAULT 'Por agendar'
                     CHECK (estado IN ('Por agendar', 'Agendada', 'Cotizada', 'Aceptada', 'No aceptada',
                                       'Sin llantas aptas', 'Cancelada')),
  motivo_cancelacion TEXT,
  revisado_en        TIMESTAMPTZ,
  revisado_por       INTEGER REFERENCES usuario (id) ON DELETE SET NULL,
  respondido_en      TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reencauche_direccion CHECK (lugar = 'Local' OR direccion IS NOT NULL),
  CONSTRAINT reencauche_agenda CHECK (estado IN ('Por agendar', 'Cancelada') OR fecha_revision IS NOT NULL),
  CONSTRAINT reencauche_cancelacion CHECK (estado <> 'Cancelada' OR motivo_cancelacion IS NOT NULL)
);
CREATE INDEX reencauche_cliente ON reencauche (cliente_id, creado_en DESC);

-- ---- Cada llanta revisada (y, si es apta, su orden de reencauche) -----------
CREATE TABLE reencauche_llanta (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reencauche_id       INTEGER NOT NULL REFERENCES reencauche (id) ON DELETE CASCADE,
  posicion            SMALLINT NOT NULL CHECK (posicion > 0),
  -- Semana y año de fabricación (4 dígitos del código DOT)
  dot                 TEXT NOT NULL CHECK (dot ~ '^[0-9]{4}$'),
  medida              TEXT NOT NULL,
  reencauches_previos SMALLINT NOT NULL DEFAULT 0 CHECK (reencauches_previos BETWEEN 0 AND 9),
  resultado           TEXT NOT NULL CHECK (resultado IN ('Apta', 'No apta')),
  motivo_no_apta      TEXT,
  banda_id            INTEGER REFERENCES banda (id),
  precio_banda        BIGINT CHECK (precio_banda > 0),
  mano_obra           BIGINT CHECK (mano_obra > 0),
  -- Orden de reencauche: solo las aptas, cuando el cliente acepta
  estado              TEXT CHECK (estado IN ('Por enviar', 'En planta', 'Lista para entregar', 'Entregada',
                                             'Rechazada en planta')),
  tercero_id          INTEGER REFERENCES tercero (id),
  enviada_en          DATE,
  motivo_planta       TEXT,
  -- Cobro: solo existe cuando la llanta se entrega terminada
  -- Medio con el que se pagó (Efectivo, Transferencia…: tabla metodo_pago)
  pago_medio          TEXT REFERENCES metodo_pago (nombre) ON UPDATE CASCADE
                      CHECK (pago_medio NOT IN ('Contado', 'Crédito')),
  pago_fecha          DATE,
  cobrada_por         INTEGER REFERENCES usuario (id) ON DELETE SET NULL,
  CONSTRAINT reencauche_llanta_posicion UNIQUE (reencauche_id, posicion),
  CONSTRAINT reencauche_llanta_resultado CHECK (
    (resultado = 'Apta' AND banda_id IS NOT NULL AND precio_banda IS NOT NULL AND mano_obra IS NOT NULL
      AND motivo_no_apta IS NULL)
    OR (resultado = 'No apta' AND motivo_no_apta IS NOT NULL AND banda_id IS NULL AND precio_banda IS NULL
      AND mano_obra IS NULL AND estado IS NULL)
  ),
  -- Fuera de "Por enviar", la llanta ya tiene reencauchadora
  CONSTRAINT reencauche_llanta_planta CHECK (estado IS NULL OR estado = 'Por enviar' OR tercero_id IS NOT NULL),
  CONSTRAINT reencauche_llanta_rechazo CHECK ((COALESCE(estado, '') = 'Rechazada en planta') = (motivo_planta IS NOT NULL)),
  -- Solo se cobra lo que se entrega
  CONSTRAINT reencauche_llanta_cobro CHECK (
    (COALESCE(estado, '') = 'Entregada') = (pago_medio IS NOT NULL AND pago_fecha IS NOT NULL)
  )
);
CREATE INDEX reencauche_llanta_orden ON reencauche_llanta (estado) WHERE estado IS NOT NULL;
