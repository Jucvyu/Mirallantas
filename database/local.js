/**
 * PostgreSQL local para desarrollo, sin instalar nada en el sistema.
 *
 * Usa `embedded-postgres`, que trae los binarios oficiales de PostgreSQL
 * como paquete de npm. Los datos quedan en database/.pgdata (ignorado por
 * git) y sobreviven entre reinicios. Usuario, clave, puerto y nombre de la
 * base salen de DATABASE_URL, así que no hay que configurarlos dos veces.
 *
 * Si ya tienes PostgreSQL instalado (o usas uno en la nube) no necesitas
 * esto: apunta DATABASE_URL a ese servidor.
 *
 *   npm run db           → arranca, aplica las migraciones pendientes y queda
 *                          escuchando; Ctrl+C lo detiene
 *
 * Con un solo comando la base queda lista: la primera vez crea el clúster y
 * la base; cada vez aplica las migraciones nuevas (nunca borra datos) y
 * avisa si todavía no existe ningún Administrador.
 */
import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { migrarArriba } from './migrate.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL. Complétala en backend/.env (o en database/.env).');
  process.exit(1);
}

const { username, password, port, pathname, hostname } = new URL(url);
if (!['localhost', '127.0.0.1'].includes(hostname)) {
  console.error(`DATABASE_URL apunta a ${hostname}: npm run db solo sirve para un servidor en localhost.`);
  process.exit(1);
}

const baseDatos = pathname.replace(/^\//, '');
const aqui = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.join(aqui, '.pgdata');

// Antes del monorepo los datos vivían en backend/.pgdata: se mueven una vez
const carpetaAnterior = path.join(aqui, '..', 'backend', '.pgdata');
if (!existsSync(carpeta) && existsSync(carpetaAnterior)) {
  try {
    renameSync(carpetaAnterior, carpeta);
    console.log('Datos movidos de backend/.pgdata a database/.pgdata.');
  } catch {
    console.error('No se pudo mover backend/.pgdata: detén el PostgreSQL que esté encendido (Ctrl+C) y vuelve a intentarlo.');
    process.exit(1);
  }
}
const yaExiste = existsSync(carpeta);

const servidor = new EmbeddedPostgres({
  databaseDir: carpeta,
  user: decodeURIComponent(username),
  password: decodeURIComponent(password),
  port: Number(port || 5432),
  persistent: true,
  // E/S síncrona: en Windows los procesos auxiliares de E/S de PostgreSQL 18
  // pueden quedar vivos (huérfanos) después de apagar el servidor
  postgresFlags: ['-c', 'io_method=sync'],
});

if (!yaExiste) {
  console.log('Inicializando el clúster de PostgreSQL en database/.pgdata…');
  await servidor.initialise();
}
await servidor.start();

try {
  await servidor.createDatabase(baseDatos);
  console.log(`Base de datos "${baseDatos}" creada.`);
} catch {
  // Ya existía: nada que hacer
}

// La estructura de la base siempre al día: aplica lo que falte
await migrarArriba(url);

// ¿Ya hay con quién entrar?
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
const { rows } = await cliente.query(
  `SELECT COUNT(*)::int AS n FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'Administrador'`,
);
await cliente.end();
if (rows[0].n === 0) {
  console.log('\nTodavía no hay ningún Administrador. Créalo (en otra terminal) con:');
  console.log('  npm run admin:crear -- --nombre "Tu Nombre" --correo tu@correo.com --documento 1020304050\n');
}

console.log(`✔ PostgreSQL listo en localhost:${port || 5432} · base "${baseDatos}". Ctrl+C para detenerlo.`);

const detener = async () => {
  await servidor.stop();
  process.exit(0);
};
process.on('SIGINT', detener);
process.on('SIGTERM', detener);
