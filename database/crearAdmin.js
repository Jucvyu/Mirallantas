/**
 * Crea la cuenta del primer Administrador (una sola vez por base).
 *
 *   npm run admin:crear -- --nombre "Nombre Apellido" --correo admin@empresa.com --documento 123456789
 *
 * La contraseña NO se escribe en el comando (quedaría en el historial de la
 * terminal): se genera una aleatoria y se muestra una sola vez. Al entrar,
 * el Administrador debe cambiarla en "Mi perfil" y activar la
 * verificación en dos pasos.
 *
 * Si ya hay un Administrador activo, no hace nada.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { values } = parseArgs({
  options: {
    nombre: { type: 'string' },
    correo: { type: 'string' },
    documento: { type: 'string' },
    'tipo-documento': { type: 'string', default: 'CC' },
  },
});

const faltantes = ['nombre', 'correo', 'documento'].filter((c) => !values[c]?.trim());
if (faltantes.length) {
  console.error(`Faltan datos: ${faltantes.map((c) => `--${c}`).join(', ')}`);
  console.error('Ejemplo: npm run admin:crear -- --nombre "Ana Pérez" --correo ana@empresa.com --documento 1020304050');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.correo)) {
  console.error('El correo no es válido.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Copia backend/.env.example como backend/.env (o usa database/.env).');
  process.exit(1);
}

// Contraseña temporal: 18 caracteres aleatorios con letras y números
const passwordTemporal = `${randomBytes(12).toString('base64url')}7a`;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows: admins } = await db.query(
    `SELECT COUNT(*)::int AS n FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre = 'Administrador' AND u.activo`,
  );
  if (admins[0].n > 0) {
    console.log('Ya existe un Administrador activo: no se creó otro. Crea más cuentas desde el módulo Usuarios.');
    process.exit(0);
  }

  const { rows: rol } = await db.query("SELECT id FROM rol WHERE nombre = 'Administrador'");
  if (!rol[0]) throw new Error('No existe el rol Administrador. Ejecuta primero: npm run migrate');

  await db.query(
    `INSERT INTO usuario (nombre, tipo_documento, numero_documento, correo, password_hash, rol_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      values.nombre.trim(),
      values['tipo-documento'],
      values.documento.trim(),
      values.correo.trim().toLowerCase(),
      await bcrypt.hash(passwordTemporal, 12),
      rol[0].id,
    ],
  );

  console.log('✔ Administrador creado.');
  console.log(`  Correo:                ${values.correo.trim().toLowerCase()}`);
  console.log(`  Contraseña temporal:   ${passwordTemporal}`);
  console.log('  Guárdala ahora: no se vuelve a mostrar. Al entrar, cámbiala y activa la verificación en dos pasos.');
} catch (error) {
  // Sin servidor, pg lanza un error sin mensaje: se explica qué pasó
  console.error(error.code === 'ECONNREFUSED' ? 'No hay conexión con PostgreSQL: enciéndelo con npm run db.' : error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
