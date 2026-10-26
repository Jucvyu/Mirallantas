/**
 * Borra los registros de la gestión comercial y deja intacto lo demás:
 *
 *   · pedidos-cotización (con sus líneas y pagos) y las ventas que salieron
 *     de ellos (las ventas directas se conservan);
 *   · compras;
 *   · solicitudes de reencauche;
 *   · cartera (créditos y abonos) y solicitudes de crédito;
 *   · los avisos que hablaban de esos documentos.
 *
 * Se conservan clientes, usuarios, roles, productos, catálogos, proveedores,
 * terceros y la configuración. La numeración de los documentos borrados
 * (PED, COM, SOL, SLC, CRE, ABO) vuelve a empezar.
 *
 *   npm run db:eliminargestion -- --confirmar
 *
 * Fuera de la base local (localhost) además exige --produccion, para que no
 * se borre producción por error.
 *
 * ⚠ No se puede deshacer. Antes saca una copia: npm run db:respaldo
 */
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** Lo que se borra, en orden: primero lo que depende de otras tablas. */
const PASOS = [
  ['Abonos', 'DELETE FROM abono'],
  ['Solicitudes de crédito', 'DELETE FROM solicitud_credito'],
  ['Créditos (cartera)', 'DELETE FROM credito'],
  ['Ventas de pedidos-cotización', 'DELETE FROM venta WHERE cotizacion_id IS NOT NULL'],
  ['Compras', 'DELETE FROM compra'],
  ['Pedidos-cotización', 'DELETE FROM cotizacion'],
  ['Solicitudes de reencauche', 'DELETE FROM solicitud_servicio'],
  ['Avisos a clientes', 'DELETE FROM notificacion'],
  ['Avisos al personal', 'DELETE FROM notificacion_personal'],
];

/** Prefijos de los documentos borrados: su numeración vuelve a empezar. */
const PREFIJOS = ['PED', 'COM', 'SOL', 'SLC', 'CRE', 'ABO'];

/** Borra la gestión en una sola transacción. Devuelve [[qué, cuántos], …]. */
export async function eliminarGestion(connectionString) {
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await db.query('BEGIN');
    const resumen = [];
    for (const [que, sql] of PASOS) {
      const { rowCount } = await db.query(sql);
      resumen.push([que, rowCount]);
    }
    await db.query('DELETE FROM consecutivo WHERE prefijo = ANY ($1)', [PREFIJOS]);
    await db.query('COMMIT');
    return resumen;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

/** ¿La dirección apunta a la base local? */
export function esLocal(connectionString) {
  const host = new URL(connectionString).hostname;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
}

// Uso desde la línea de comandos
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      confirmar: { type: 'boolean', default: false },
      produccion: { type: 'boolean', default: false },
    },
  });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL. Complétala en backend/.env (o en database/.env).');
    process.exit(1);
  }
  const host = new URL(url).hostname;
  if (!values.confirmar) {
    console.error(`Esto borra pedidos-cotización, compras, reencauches, cartera y solicitudes de crédito de: ${host}`);
    console.error('No se puede deshacer. Saca antes una copia (npm run db:respaldo) y repite con:');
    console.error('  npm run db:eliminargestion -- --confirmar');
    process.exit(1);
  }
  if (!esLocal(url) && !values.produccion) {
    console.error(`La base (${host}) NO es la local. Si de verdad quieres borrar la gestión ahí, agrega --produccion.`);
    process.exit(1);
  }
  eliminarGestion(url)
    .then((resumen) => {
      console.log(`✔ Gestión borrada en ${host}:`);
      for (const [que, cuantos] of resumen) console.log(`   ${que}: ${cuantos}`);
    })
    .catch((error) => {
      // Sin servidor, pg lanza un error sin mensaje: se explica qué pasó
      console.error(error.code === 'ECONNREFUSED' ? 'No hay conexión con PostgreSQL: enciéndelo con npm run db.' : error.message);
      process.exit(1);
    });
}
