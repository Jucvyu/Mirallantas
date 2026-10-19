import { query } from '../db.js';

/**
 * Listas del sistema (tablas tipo_documento, metodo_pago y medio_pago).
 * Las usan los formularios del frontend para llenar sus selectores.
 */
export async function listar() {
  const [tipos, metodos, medios] = await Promise.all([
    query('SELECT codigo, nombre FROM tipo_documento ORDER BY orden, codigo'),
    query('SELECT nombre FROM metodo_pago ORDER BY orden, nombre'),
    query('SELECT nombre FROM medio_pago ORDER BY orden, nombre'),
  ]);
  return {
    tiposDocumento: tipos.rows,
    metodosPago: metodos.rows.map((r) => r.nombre),
    mediosPago: medios.rows.map((r) => r.nombre),
  };
}
