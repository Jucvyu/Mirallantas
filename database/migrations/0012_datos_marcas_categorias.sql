-- Datos iniciales de Marcas y Categorías (tipos de llanta).
-- Se puede correr varias veces: ON CONFLICT no duplica ni pisa lo que ya exista.
-- Ejecútalo en Supabase (SQL Editor) o en DBeaver/pgAdmin contra la base.
-- Los tipos de vehículo ya los crea la migración 0005.

BEGIN;

INSERT INTO marca (nombre) VALUES
  ('Michelin'), ('Bridgestone'), ('Goodyear'), ('Continental'), ('Pirelli'),
  ('Firestone'), ('BFGoodrich'), ('General Tire'), ('Hankook'), ('Kumho'),
  ('Yokohama'), ('Toyo'), ('Dunlop'), ('Falken'), ('Nexen'),
  ('Maxxis'), ('GT Radial'), ('Triangle'), ('Linglong'), ('Sailun'),
  ('Double Coin'), ('Aeolus'), ('Westlake'), ('Otani'), ('Kenda')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO categoria (nombre, descripcion, color) VALUES
  ('Turismo',          'Llantas para automóviles de uso diario',              '#FBBF24'),
  ('Camioneta / SUV',  'Llantas para camionetas y SUV, uso mixto y 4x4',      '#F97316'),
  ('Carga liviana',    'Llantas para furgones y camionetas de carga',         '#22C55E'),
  ('Camión y bus',     'Llantas radiales para camión, tractomula y bus',      '#3B82F6'),
  ('Agrícola',         'Llantas para tractores y maquinaria agrícola',        '#84CC16'),
  ('Industrial',       'Llantas para montacargas y maquinaria industrial',    '#A855F7'),
  ('Todo terreno',     'Llantas A/T y M/T para trocha y barro',               '#B45309'),
  ('Reencauche',       'Llantas reencauchadas listas para la venta',          '#64748B')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
