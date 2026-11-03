-- Revierte 0036: "Otro" vuelve a ofrecerse.
UPDATE metodo_pago SET activo = TRUE WHERE nombre = 'Otro';
