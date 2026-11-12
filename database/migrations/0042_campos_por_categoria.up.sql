-- =========================================================================
-- 0042 · Datos que no aplican según la categoría
--
-- No todas las llantas usan los mismos datos: una de moto no lleva lonas
-- ni posición de tracción o dirección. Cada categoría guarda en
-- `campos_ocultos` los datos de la ficha y de las medidas que no aplican;
-- el panel no los pide al registrar un producto de esa categoría. Vacío =
-- se piden todos (así quedan las categorías que ya existen).
-- =========================================================================

ALTER TABLE categoria
  ADD COLUMN campos_ocultos TEXT[] NOT NULL DEFAULT '{}'
    CONSTRAINT categoria_campos_ocultos_validos CHECK (
      campos_ocultos <@ ARRAY[
        -- Ficha técnica del producto
        'uso', 'labrado', 'construccion', 'sinCamara', 'recauchable', 'garantiaMeses', 'paisOrigen',
        -- Datos de cada medida
        'posicion', 'indiceCarga', 'lonas', 'profundidadLabrado', 'pesoKg', 'codigoFabricante'
      ]::TEXT[]
    );
