/**
 * Ejecutor de migraciones SQL.
 *
 *   npm run migrate          aplica, en orden, las migraciones pendientes
 *   npm run migrate:down     revierte la última migración aplicada
 *   npm run migrate:status   lista qué está aplicado y qué no
 * (desde la raíz del proyecto o dentro de database/)
 *
 * Cada migración son dos archivos en database/migrations: NNNN_nombre.up.sql y
 * NNNN_nombre.down.sql. Se ejecutan dentro de una transacción, así que una
 * migración que falla no deja el esquema a medias. Las aplicadas se
 * registran en la tabla `schema_migrations`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const CARPETA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function listarMigraciones() {
  const archivos = await readdir(CARPETA);
  return archivos
    .filter((a) => a.endsWith('.up.sql'))
    .map((a) => a.replace(/\.up\.sql$/, ''))
    .sort();
}

async function aplicadas(cliente) {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre      TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const { rows } = await cliente.query('SELECT nombre FROM schema_migrations ORDER BY nombre');
  return rows.map((r) => r.nombre);
}

async function ejecutar(cliente, nombre, sentido) {
  const sql = await readFile(path.join(CARPETA, `${nombre}.${sentido}.sql`), 'utf8');
  await cliente.query('BEGIN');
  try {
    await cliente.query(sql);
    if (sentido === 'up') {
      await cliente.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [nombre]);
    } else {
      await cliente.query('DELETE FROM schema_migrations WHERE nombre = $1', [nombre]);
    }
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw new Error(`La migración ${nombre} (${sentido}) falló: ${error.message}`, { cause: error });
  }
}

/** Aplica las migraciones pendientes. Lo usan el CLI y las pruebas. */
export async function migrarArriba(connectionString, { silencioso = false } = {}) {
  const cliente = new pg.Client({ connectionString });
  await cliente.connect();
  try {
    const hechas = new Set(await aplicadas(cliente));
    const pendientes = (await listarMigraciones()).filter((m) => !hechas.has(m));
    for (const nombre of pendientes) {
      await ejecutar(cliente, nombre, 'up');
      if (!silencioso) console.log(`✔ aplicada ${nombre}`);
    }
    if (!silencioso && pendientes.length === 0) console.log('No hay migraciones pendientes.');
    return pendientes;
  } finally {
    await cliente.end();
  }
}

async function migrarAbajo(connectionString) {
  const cliente = new pg.Client({ connectionString });
  await cliente.connect();
  try {
    const hechas = await aplicadas(cliente);
    const ultima = hechas.at(-1);
    if (!ultima) return console.log('No hay migraciones aplicadas.');
    await ejecutar(cliente, ultima, 'down');
    console.log(`✔ revertida ${ultima}`);
  } finally {
    await cliente.end();
  }
}

async function estado(connectionString) {
  const cliente = new pg.Client({ connectionString });
  await cliente.connect();
  try {
    const hechas = new Set(await aplicadas(cliente));
    for (const nombre of await listarMigraciones()) {
      console.log(`${hechas.has(nombre) ? '✔ aplicada ' : '· pendiente'}  ${nombre}`);
    }
  } finally {
    await cliente.end();
  }
}

// Uso desde la línea de comandos
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL. Copia backend/.env.example como backend/.env (o usa database/.env).');
    process.exit(1);
  }
  const accion = process.argv[2] ?? 'up';
  const acciones = { up: () => migrarArriba(url), down: () => migrarAbajo(url), status: () => estado(url) };
  if (!acciones[accion]) {
    console.error('Uso: node migrate.js [up|down|status]');
    process.exit(1);
  }
  acciones[accion]().catch((error) => {
    // Sin servidor, pg lanza un error sin mensaje: se explica qué pasó
    console.error(error.code === 'ECONNREFUSED' ? 'No hay conexión con PostgreSQL: enciéndelo con npm run db.' : error.message);
    process.exit(1);
  });
}
