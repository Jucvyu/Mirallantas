-- =========================================================================
-- 0001 · Esquema inicial de MiraLlantas ERP
--
-- Reproduce el modelo que ya maneja el frontend (src/data/mockData.js),
-- ahora con las reglas que antes no existían: claves foráneas, valores
-- únicos, estados válidos y montos no negativos.
--
-- Convenciones
--   · Montos en pesos colombianos enteros (BIGINT). COP no maneja centavos.
--   · Estados de catálogo (cliente, producto…) como booleano `activo`.
--   · Estados de documentos como texto con CHECK, en el vocabulario del
--     frontend, para poder ampliarlos sin recrear tipos ENUM.
--   · `numero` es el consecutivo visible del documento (PED-2024-001…);
--     `id` es la clave interna y nunca se muestra.
-- =========================================================================

-- ---- Numeración de documentos ---------------------------------------------
-- Un contador por prefijo y año. La actualización bloquea la fila, así que
-- dos solicitudes simultáneas nunca obtienen el mismo número.
CREATE TABLE consecutivo (
  prefijo TEXT    NOT NULL,
  anio    INTEGER NOT NULL,
  ultimo  INTEGER NOT NULL DEFAULT 0 CHECK (ultimo >= 0),
  PRIMARY KEY (prefijo, anio)
);

CREATE FUNCTION siguiente_numero(p_prefijo TEXT, p_digitos INTEGER DEFAULT 3)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_anio   INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_ultimo INTEGER;
BEGIN
  INSERT INTO consecutivo (prefijo, anio, ultimo)
  VALUES (p_prefijo, v_anio, 1)
  ON CONFLICT (prefijo, anio) DO UPDATE SET ultimo = consecutivo.ultimo + 1
  RETURNING ultimo INTO v_ultimo;

  RETURN p_prefijo || '-' || v_anio || '-' || LPAD(v_ultimo::TEXT, p_digitos, '0');
END;
$$;

-- ---- Configuración de la empresa ------------------------------------------
-- Una sola fila (id = 1). Queda vacía hasta que un administrador registre
-- los datos reales: no se precargan datos empresariales.
CREATE TABLE empresa (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre        TEXT NOT NULL,
  razon_social  TEXT NOT NULL,
  nit           TEXT NOT NULL,
  direccion     TEXT NOT NULL,
  ciudad        TEXT,
  telefono      TEXT NOT NULL,
  correo        TEXT NOT NULL,
  logo_url      TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Seguridad: roles, permisos y usuarios --------------------------------
CREATE TABLE permiso (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modulo TEXT NOT NULL UNIQUE
);

CREATE TABLE rol (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rol_permiso (
  rol_id     INTEGER NOT NULL REFERENCES rol (id) ON DELETE CASCADE,
  permiso_id INTEGER NOT NULL REFERENCES permiso (id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

-- ---- Terceros del negocio -------------------------------------------------
CREATE TABLE cliente (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_documento   TEXT NOT NULL CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte')),
  numero_documento TEXT NOT NULL,
  nombre_completo  TEXT NOT NULL,
  telefono         TEXT,
  correo           TEXT,
  direccion        TEXT,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cliente_documento_unico UNIQUE (tipo_documento, numero_documento)
);

CREATE TABLE usuario (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre           TEXT NOT NULL,
  tipo_documento   TEXT NOT NULL CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte')),
  numero_documento TEXT NOT NULL,
  correo           TEXT NOT NULL,
  telefono         TEXT,
  password_hash    TEXT NOT NULL,
  rol_id           INTEGER NOT NULL REFERENCES rol (id),
  -- Solo para usuarios del portal: el cliente cuyos datos puede ver
  cliente_id       INTEGER REFERENCES cliente (id),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- El correo es único sin importar mayúsculas
CREATE UNIQUE INDEX usuario_correo_unico ON usuario (LOWER(correo));

CREATE TABLE proveedor (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_documento      TEXT NOT NULL CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte')),
  numero_documento    TEXT NOT NULL,
  nombre_razon_social TEXT NOT NULL,
  contacto            TEXT,
  telefono            TEXT,
  correo              TEXT,
  direccion           TEXT,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT proveedor_documento_unico UNIQUE (tipo_documento, numero_documento)
);

-- Reencauchadoras que ejecutan el servicio
CREATE TABLE tercero (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_documento      TEXT NOT NULL CHECK (tipo_documento IN ('CC', 'CE', 'NIT', 'Pasaporte')),
  numero_documento    TEXT NOT NULL,
  nombre_razon_social TEXT NOT NULL,
  contacto            TEXT,
  telefono            TEXT,
  correo              TEXT,
  direccion           TEXT,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT tercero_documento_unico UNIQUE (tipo_documento, numero_documento)
);

-- ---- Catálogo -------------------------------------------------------------
CREATE TABLE categoria (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  color       TEXT NOT NULL DEFAULT '#FBBF24' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE marca (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tipo_vehiculo (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

-- La medida se conserva como texto, igual que en el frontend actual. Su
-- paso a un catálogo con buscador es una migración posterior (etapa de
-- medidas), que identificará coincidencias y casos a revisar.
CREATE TABLE producto (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo           TEXT NOT NULL,
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  categoria_id     INTEGER NOT NULL REFERENCES categoria (id),
  marca_id         INTEGER NOT NULL REFERENCES marca (id),
  medidas          TEXT NOT NULL,
  tipo_vehiculo_id INTEGER REFERENCES tipo_vehiculo (id),
  precio_compra    BIGINT NOT NULL DEFAULT 0 CHECK (precio_compra >= 0),
  precio_venta     BIGINT NOT NULL CHECK (precio_venta >= 0),
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producto_codigo_key UNIQUE (codigo)
);

CREATE TABLE producto_imagen (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES producto (id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  orden       SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE servicio (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  descripcion   TEXT,
  precio        BIGINT NOT NULL CHECK (precio >= 0),
  garantia_dias INTEGER NOT NULL DEFAULT 0 CHECK (garantia_dias >= 0),
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---- Solicitudes de servicio de reencauche --------------------------------
CREATE TABLE solicitud_servicio (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero           TEXT NOT NULL UNIQUE,
  cliente_id       INTEGER NOT NULL REFERENCES cliente (id),
  servicio_id      INTEGER NOT NULL REFERENCES servicio (id),
  tercero_id       INTEGER REFERENCES tercero (id),
  medidas          TEXT,
  cantidad         INTEGER NOT NULL CHECK (cantidad > 0),
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  estado           TEXT NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN ('Pendiente', 'En proceso', 'Completado', 'Cancelado')),
  estado_evidencia TEXT NOT NULL DEFAULT 'Pendiente de revisión'
                   CHECK (estado_evidencia IN ('Pendiente de revisión', 'Apta', 'No apta')),
  garantia         BOOLEAN NOT NULL DEFAULT FALSE,
  tiempo_estimado  TEXT,
  descripcion      TEXT,
  foto_url         TEXT
);

-- ---- Cotización-pedido ----------------------------------------------------
CREATE TABLE cotizacion (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero             TEXT NOT NULL UNIQUE,
  cliente_id         INTEGER NOT NULL REFERENCES cliente (id),
  proveedor_id       INTEGER REFERENCES proveedor (id),
  fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago        TEXT NOT NULL CHECK (metodo_pago IN ('Contado', 'Crédito')),
  plazo_dias         INTEGER NOT NULL DEFAULT 0 CHECK (plazo_dias IN (0, 30, 60, 90)),
  subtotal           BIGINT NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  interes            BIGINT NOT NULL DEFAULT 0 CHECK (interes >= 0),
  total              BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  cuota_inicial      BIGINT NOT NULL DEFAULT 0 CHECK (cuota_inicial >= 0),
  -- false mientras el asesor no haya confirmado el valor de la cotización
  confirmado         BOOLEAN NOT NULL DEFAULT FALSE,
  estado             TEXT NOT NULL DEFAULT 'Pendiente'
                     CHECK (estado IN ('Pendiente', 'Aprobada', 'En proceso', 'Completada', 'Rechazada')),
  estado_entrega     TEXT NOT NULL DEFAULT 'Pendiente'
                     CHECK (estado_entrega IN ('Pendiente', 'En camino', 'Entregado', 'Cancelado')),
  direccion_entrega  TEXT,
  motivo_cancelacion TEXT,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A crédito siempre hay plazo; de contado, nunca
  CONSTRAINT cotizacion_plazo_coherente CHECK ((metodo_pago = 'Crédito') = (plazo_dias > 0)),
  CONSTRAINT cotizacion_cuota_no_supera_total CHECK (cuota_inicial <= total)
);
CREATE INDEX cotizacion_cliente_idx ON cotizacion (cliente_id);

-- Un mismo detalle reúne productos y servicios, como en la pantalla.
-- `descripcion`, `medida` y `precio_unitario` son una foto del momento:
-- si el catálogo cambia después, el documento conserva sus valores.
CREATE TABLE cotizacion_detalle (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id         INTEGER NOT NULL REFERENCES cotizacion (id) ON DELETE CASCADE,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('producto', 'servicio')),
  producto_id           INTEGER REFERENCES producto (id),
  servicio_id           INTEGER REFERENCES servicio (id),
  solicitud_servicio_id INTEGER REFERENCES solicitud_servicio (id),
  descripcion           TEXT NOT NULL,
  medida                TEXT,
  cantidad              INTEGER NOT NULL CHECK (cantidad > 0),
  -- NULL mientras el valor no esté confirmado (se muestra "—")
  precio_unitario       BIGINT CHECK (precio_unitario >= 0),
  subtotal              BIGINT CHECK (subtotal >= 0),
  CONSTRAINT cotizacion_detalle_referencia CHECK (
    (tipo = 'producto' AND producto_id IS NOT NULL AND servicio_id IS NULL)
    OR (tipo = 'servicio' AND servicio_id IS NOT NULL AND producto_id IS NULL)
  )
);
CREATE INDEX cotizacion_detalle_cotizacion_idx ON cotizacion_detalle (cotizacion_id);

-- ---- Venta ----------------------------------------------------------------
CREATE TABLE venta (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          TEXT NOT NULL UNIQUE,
  cliente_id      INTEGER NOT NULL REFERENCES cliente (id),
  -- Una cotización genera como máximo una venta. NULL = venta directa.
  cotizacion_id   INTEGER UNIQUE REFERENCES cotizacion (id),
  proveedor_id    INTEGER REFERENCES proveedor (id),
  tercero_id      INTEGER REFERENCES tercero (id),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago     TEXT NOT NULL CHECK (metodo_pago IN ('Contado', 'Crédito')),
  interes         BIGINT NOT NULL DEFAULT 0 CHECK (interes >= 0),
  total           BIGINT NOT NULL CHECK (total >= 0),
  cuota_inicial   BIGINT NOT NULL DEFAULT 0 CHECK (cuota_inicial >= 0),
  estado          TEXT NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado IN ('Pendiente', 'Completada', 'Anulada')),
  estado_entrega  TEXT NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado_entrega IN ('Pendiente', 'En camino', 'Entregado', 'Cancelado')),
  comprobante_url TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venta_cuota_no_supera_total CHECK (cuota_inicial <= total)
);
CREATE INDEX venta_cliente_idx ON venta (cliente_id);

CREATE TABLE venta_detalle (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_id        INTEGER NOT NULL REFERENCES venta (id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('producto', 'servicio')),
  producto_id     INTEGER REFERENCES producto (id),
  servicio_id     INTEGER REFERENCES servicio (id),
  descripcion     TEXT NOT NULL,
  medida          TEXT,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario BIGINT NOT NULL CHECK (precio_unitario >= 0),
  subtotal        BIGINT NOT NULL CHECK (subtotal >= 0),
  CONSTRAINT venta_detalle_referencia CHECK (
    (tipo = 'producto' AND producto_id IS NOT NULL AND servicio_id IS NULL)
    OR (tipo = 'servicio' AND servicio_id IS NOT NULL AND producto_id IS NULL)
  )
);
CREATE INDEX venta_detalle_venta_idx ON venta_detalle (venta_id);

-- ---- Compra al proveedor --------------------------------------------------
CREATE TABLE compra (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero         TEXT NOT NULL UNIQUE,
  proveedor_id   INTEGER NOT NULL REFERENCES proveedor (id),
  cotizacion_id  INTEGER REFERENCES cotizacion (id),
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  total          BIGINT NOT NULL CHECK (total >= 0),
  estado         TEXT NOT NULL DEFAULT 'Pendiente'
                 CHECK (estado IN ('Pendiente', 'Recibida', 'Anulada')),
  estado_entrega TEXT NOT NULL DEFAULT 'Pendiente'
                 CHECK (estado_entrega IN ('Pendiente', 'En camino', 'Entregado', 'Cancelado')),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El precio unitario de cada línea es el definitivo de esa compra y no
-- cambia aunque luego cambie el precio del producto.
CREATE TABLE compra_detalle (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compra_id       INTEGER NOT NULL REFERENCES compra (id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES producto (id),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario BIGINT NOT NULL CHECK (precio_unitario >= 0),
  subtotal        BIGINT NOT NULL CHECK (subtotal >= 0),
  -- Si la línea venía de la cotización de origen o la sumó el asesor
  origen          TEXT NOT NULL DEFAULT 'Cotización' CHECK (origen IN ('Cotización', 'Adicional'))
);
CREATE INDEX compra_detalle_compra_idx ON compra_detalle (compra_id);

-- ---- Cartera: créditos, abonos y solicitudes ------------------------------
CREATE TABLE credito (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          TEXT NOT NULL UNIQUE,
  cliente_id      INTEGER NOT NULL REFERENCES cliente (id),
  venta_id        INTEGER REFERENCES venta (id),
  cotizacion_id   INTEGER REFERENCES cotizacion (id),
  monto_total     BIGINT NOT NULL CHECK (monto_total > 0),
  saldo_pendiente BIGINT NOT NULL CHECK (saldo_pendiente >= 0),
  plazo_dias      INTEGER NOT NULL CHECK (plazo_dias IN (30, 60, 90)),
  fecha_apertura  DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_limite    DATE NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT credito_saldo_no_supera_monto CHECK (saldo_pendiente <= monto_total),
  CONSTRAINT credito_fechas_coherentes CHECK (fecha_limite >= fecha_apertura)
);
-- Regla de negocio: un cliente solo puede tener un crédito abierto
CREATE UNIQUE INDEX credito_un_abierto_por_cliente ON credito (cliente_id) WHERE saldo_pendiente > 0;

CREATE TABLE abono (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero          TEXT NOT NULL UNIQUE,
  credito_id      INTEGER NOT NULL REFERENCES credito (id),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  monto           BIGINT NOT NULL CHECK (monto > 0),
  medio_pago      TEXT NOT NULL CHECK (medio_pago IN ('Efectivo', 'Transferencia', 'Tarjeta')),
  comprobante_url TEXT,
  estado          TEXT NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado IN ('Pendiente', 'Confirmado', 'Rechazado')),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX abono_credito_idx ON abono (credito_id);

CREATE TABLE solicitud_credito (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero     TEXT NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES cliente (id),
  monto      BIGINT NOT NULL CHECK (monto > 0),
  plazo_dias INTEGER NOT NULL CHECK (plazo_dias IN (30, 60, 90)),
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  estado     TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada')),
  motivo     TEXT
);
