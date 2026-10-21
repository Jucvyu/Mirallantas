/**
 * Copias de seguridad de la base, sin instalar nada más que Node.
 *
 *   npm run db:respaldo                          → crea respaldos/mirallantas-AAAA-MM-DD-HHMM.json
 *   npm run db:restaurar -- respaldos/archivo.json  → lo carga en una base VACÍA
 *
 * El respaldo es un JSON con todas las filas de todas las tablas y la lista
 * de migraciones aplicadas. Para restaurar:
 *   1. Crea una base nueva y vacía y aplica las migraciones (npm run migrate).
 *   2. Ejecuta db:restaurar apuntando DATABASE_URL a esa base.
 * La restauración se niega a correr si la base ya tiene datos de negocio o
 * si sus migraciones no coinciden con las del respaldo.
 *
 * ⚠ El archivo contiene datos personales y hashes de contraseñas: guárdalo
 * cifrado y fuera del repositorio (la carpeta respaldos/ está en .gitignore).
 * En producción usa además las copias automáticas del proveedor.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Tablas del esquema `public` ordenadas para insertar: primero las que no
 * dependen de ninguna y después las que las referencian.
 */
async function tablasEnOrden(db) {
  const { rows: tablas } = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename`,
  );
  const { rows: dependencias } = await db.query(
    `SELECT DISTINCT c.conrelid::regclass::text AS tabla, c.confrelid::regclass::text AS depende_de
       FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND c.conrelid <> c.confrelid`,
  );
  const pendientes = new Set(tablas.map((t) => t.tablename));
  const orden = [];
  while (pendientes.size) {
    const listas = [...pendientes].filter((t) =>
      dependencias.every((d) => d.tabla !== t || !pendientes.has(d.depende_de)),
    );
    if (!listas.length) throw new Error('Dependencias circulares entre tablas.');
    for (const t of listas) {
      orden.push(t);
      pendientes.delete(t);
    }
  }
  return orden;
}

/** Lee todas las filas de la base. Devuelve el objeto del respaldo. */
export async function crearRespaldo(connectionString) {
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    // Una sola foto coherente de toda la base, aunque haya gente usándola
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const migraciones = (await db.query('SELECT nombre FROM schema_migrations ORDER BY nombre')).rows.map((r) => r.nombre);
    const tablas = {};
    for (const tabla of await tablasEnOrden(db)) {
      // row_to_json conserva los tipos tal como PostgreSQL los escribe
      const { rows } = await db.query(`SELECT row_to_json(t) AS fila FROM ${tabla} t`);
      tablas[tabla] = rows.map((r) => r.fila);
    }
    await db.query('COMMIT');
    return { formato: 'mirallantas-respaldo-v1', creado: new Date().toISOString(), migraciones, tablas };
  } finally {
    await db.end();
  }
}

/** Carga un respaldo en una base vacía con las mismas migraciones. */
export async function restaurarRespaldo(connectionString, respaldo) {
  if (respaldo.formato !== 'mirallantas-respaldo-v1') throw new Error('El archivo no es un respaldo de MiraLlantas.');

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const migraciones = (await db.query('SELECT nombre FROM schema_migrations ORDER BY nombre')).rows.map((r) => r.nombre);
    if (JSON.stringify(migraciones) !== JSON.stringify(respaldo.migraciones)) {
      throw new Error('Las migraciones de la base no coinciden con las del respaldo. Ejecuta npm run migrate primero.');
    }
    const { rows } = await db.query('SELECT (SELECT COUNT(*) FROM cliente) + (SELECT COUNT(*) FROM usuario) AS n');
    if (Number(rows[0].n) > 0) throw new Error('La base de destino ya tiene datos: restaura sobre una base nueva.');

    await db.query('BEGIN');
    const orden = await tablasEnOrden(db);
    // Los triggers propios (p. ej. el que protege al rol Administrador) se
    // apagan solo dentro de esta transacción; las llaves foráneas siguen activas
    for (const tabla of orden) await db.query(`ALTER TABLE ${tabla} DISABLE TRIGGER USER`);
    // Las migraciones crean los roles y permisos base: se vacía todo y se
    // carga lo del respaldo (primero se borran las tablas que dependen de otras)
    for (const tabla of [...orden].reverse()) await db.query(`DELETE FROM ${tabla}`);

    for (const tabla of orden) {
      const filas = respaldo.tablas[tabla] ?? [];
      if (filas.length) {
        await db.query(
          `INSERT INTO ${tabla} OVERRIDING SYSTEM VALUE
           SELECT * FROM json_populate_recordset(NULL::${tabla}, $1)`,
          [JSON.stringify(filas)],
        );
      }
      // Las columnas autonuméricas siguen desde el id más alto restaurado
      const { rows: identidades } = await db.query(
        `SELECT attname FROM pg_attribute WHERE attrelid = $1::regclass AND attidentity <> '' AND NOT attisdropped`,
        [tabla],
      );
      for (const { attname } of identidades) {
        await db.query(
          `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${attname}) FROM ${tabla}), 0) + 1, false)`,
          [tabla, attname],
        );
      }
    }
    for (const tabla of orden) await db.query(`ALTER TABLE ${tabla} ENABLE TRIGGER USER`);
    await db.query('COMMIT');
    return Object.fromEntries(Object.entries(respaldo.tablas).map(([t, f]) => [t, f.length]));
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

// Uso desde la línea de comandos
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [accion, archivo] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Complétala en backend/.env (o en database/.env).');
    process.exit(1);
  }
  try {
    if (accion === 'crear') {
      const respaldo = await crearRespaldo(process.env.DATABASE_URL);
      const carpeta = path.resolve('respaldos');
      await mkdir(carpeta, { recursive: true });
      const sello = respaldo.creado.slice(0, 19).replace(/[T:]/g, '-');
      const destino = path.join(carpeta, `mirallantas-${sello}.json`);
      await writeFile(destino, JSON.stringify(respaldo));
      const filas = Object.values(respaldo.tablas).reduce((s, f) => s + f.length, 0);
      console.log(`✔ Respaldo creado: ${destino} (${filas} filas)`);
    } else if (accion === 'restaurar' && archivo) {
      const conteo = await restaurarRespaldo(process.env.DATABASE_URL, JSON.parse(await readFile(archivo, 'utf8')));
      const filas = Object.values(conteo).reduce((s, n) => s + n, 0);
      console.log(`✔ Respaldo restaurado (${filas} filas en ${Object.keys(conteo).length} tablas).`);
    } else {
      console.error('Uso: node respaldo.js crear | restaurar <archivo.json>');
      process.exit(1);
    }
  } catch (error) {
    // Sin servidor, pg lanza un error sin mensaje: se explica qué pasó
    console.error(error.code === 'ECONNREFUSED' ? 'No hay conexión con PostgreSQL: enciéndelo con npm run db.' : error.message);
    process.exit(1);
  }
}
