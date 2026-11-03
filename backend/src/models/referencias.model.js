import { query } from '../db.js';

/**
 * Listas del sistema (tablas tipo_documento y metodo_pago). Las usan los
 * formularios del frontend para llenar sus selectores. De metodo_pago salen
 * dos listas: cómo se pacta el pago (`forma`) y con qué se paga (`medio`).
 */
export async function listar() {
  const [tipos, metodos] = await Promise.all([
    query('SELECT codigo, nombre FROM tipo_documento ORDER BY orden, codigo'),
    query('SELECT nombre, tipo FROM metodo_pago WHERE activo ORDER BY orden, nombre'),
  ]);
  const nombresDe = (tipo) => metodos.rows.filter((r) => r.tipo === tipo).map((r) => r.nombre);
  return {
    tiposDocumento: tipos.rows,
    metodosPago: nombresDe('forma'),
    mediosPago: nombresDe('medio'),
  };
}
