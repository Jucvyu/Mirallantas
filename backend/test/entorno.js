/**
 * Entorno de pruebas: un PostgreSQL real y desechable.
 *
 * Levanta un servidor con embedded-postgres en una carpeta temporal y un
 * puerto libre, aplica las migraciones, carga los datos de prueba y
 * arranca la API. Al terminar, lo destruye todo. Las pruebas nunca tocan la
 * base de desarrollo ni la de producción.
 */
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { migrarArriba } from '../../database/migrate.js';
import { sembrar } from './fixtures/sembrar.js';

const puertoLibre = () =>
  new Promise((resolver, rechazar) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', rechazar);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolver(port));
    });
  });

export async function levantarEntorno() {
  const carpeta = await mkdtemp(path.join(os.tmpdir(), 'mirallantas-test-'));
  const puertoDb = await puertoLibre();
  const clave = randomBytes(12).toString('hex');

  const servidorDb = new EmbeddedPostgres({
    databaseDir: carpeta,
    user: 'prueba',
    password: clave,
    port: puertoDb,
    persistent: false,
    // E/S síncrona: en Windows los procesos auxiliares de E/S de PostgreSQL 18
    // quedan huérfanos al apagar el servidor y la prueba nunca termina
    postgresFlags: ['-c', 'io_method=sync'],
    onLog: () => {},
  });
  await servidorDb.initialise();
  await servidorDb.start();
  await servidorDb.createDatabase('mirallantas_test');

  const databaseUrl = `postgres://prueba:${clave}@localhost:${puertoDb}/mirallantas_test`;
  const passwordDemo = randomBytes(9).toString('base64url');

  await migrarArriba(databaseUrl, { silencioso: true });
  await sembrar(databaseUrl, { password: passwordDemo });

  // La configuración se lee al importar la app: primero las variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = randomBytes(48).toString('base64url');
  process.env.CLAVE_CIFRADO = randomBytes(48).toString('base64url');
  delete process.env.CLOUDINARY_URL;
  const { crearApp } = await import('../src/app.js');
  const { pool } = await import('../src/db.js');

  const servidorApi = await new Promise((resolver) => {
    const s = crearApp().listen(0, () => resolver(s));
  });
  const base = `http://localhost:${servidorApi.address().port}/api`;

  /** Petición a la API. Devuelve { estado, cuerpo }. */
  const api = async (ruta, { metodo = 'GET', token, cuerpo, cabeceras = {} } = {}) => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...cabeceras,
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    const tipo = respuesta.headers.get('content-type') ?? '';
    // Un PDF (u otro archivo) se devuelve como bytes, sin interpretarlo
    if (!tipo.includes('json')) {
      const bytes = Buffer.from(await respuesta.arrayBuffer());
      return { estado: respuesta.status, cuerpo: null, tipo, bytes };
    }
    const texto = await respuesta.text();
    return { estado: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null, tipo };
  };

  const iniciarSesion = async (correo, password = passwordDemo) => {
    const { estado, cuerpo } = await api('/auth/login', { metodo: 'POST', cuerpo: { correo, password } });
    if (estado !== 200) throw new Error(`No se pudo iniciar sesión como ${correo}: ${estado}`);
    return cuerpo.token;
  };

  /** Conexión directa a la base, para probar las reglas del esquema. */
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();

  const cerrar = async () => {
    await db.end();
    await new Promise((resolver) => servidorApi.close(resolver));
    await pool.end();
    await servidorDb.stop();
    await rm(carpeta, { recursive: true, force: true });
  };

  return { api, base, iniciarSesion, db, databaseUrl, passwordDemo, cerrar };
}
