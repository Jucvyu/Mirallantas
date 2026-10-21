import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// BIGINT (OID 20): los valores en pesos llegan como número, no como texto.
// Es seguro mientras no superen 2^53 (≈ 9 mil billones de pesos).
types.setTypeParser(20, (valor) => Number(valor));
// NUMERIC (OID 1700): idem para promedios y sumas calculadas
types.setTypeParser(1700, (valor) => Number(valor));
// DATE (OID 1082): se devuelve tal cual ('2024-07-18'). Convertirlo a Date
// lo desplazaría un día al serializarlo en UTC.
types.setTypeParser(1082, (valor) => valor);

/** Opciones de SSL según DATABASE_SSL (ver config.js). */
function opcionesSsl(modo) {
  if (modo === 'true') return { rejectUnauthorized: true };
  if (modo === 'no-verify') return { rejectUnauthorized: false };
  return undefined;
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: opcionesSsl(config.databaseSsl),
  max: 10,
});

// Cada conexión nueva trabaja en la hora de Colombia (CURRENT_DATE es "hoy"
// aquí) y corta cualquier consulta que tarde más de 15 segundos, para que
// una petición abusiva no deje la base ocupada. Se fija con una consulta (y
// no con parámetros de arranque) porque los "poolers" de las bases en la
// nube, como el de Supabase, no siempre los aceptan. pg ejecuta esta consulta
// antes que cualquier otra del mismo cliente.
pool.on('connect', (cliente) => {
  cliente
    .query("SELECT set_config('TimeZone', $1, false), set_config('statement_timeout', '15000', false)", [
      config.zonaHoraria,
    ])
    .catch((error) => console.error('No se pudo preparar la conexión a la base:', error.message));
});

/** Atajo para consultas sueltas. */
export const query = (texto, valores) => pool.query(texto, valores);

/**
 * Ejecuta `trabajo(cliente)` dentro de una transacción. Si algo falla, se
 * revierte todo: ninguna operación queda a medias entre varias tablas.
 */
export async function enTransaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
