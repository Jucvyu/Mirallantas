/**
 * Restablece la contraseña de una cuenta cuando nadie la recuerda (por
 * ejemplo, el administrador de la base local de desarrollo).
 *
 *   npm run clave:restablecer -- --correo admin@mirallantas.test
 *
 * La contraseña NO se escribe en el comando (quedaría en el historial de la
 * terminal): se genera una aleatoria y se muestra una sola vez. Además se
 * desbloquea la cuenta y se cierran sus sesiones abiertas. Al entrar,
 * cámbiala en "Mi perfil".
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { values } = parseArgs({ options: { correo: { type: 'string' } } });
const correo = values.correo?.trim().toLowerCase();
if (!correo) {
  console.error('Falta --correo. Ejemplo: npm run clave:restablecer -- --correo admin@mirallantas.test');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Complétala en backend/.env (o en database/.env).');
  process.exit(1);
}

// Contraseña temporal: 18 caracteres aleatorios con letras y números
const passwordTemporal = `${randomBytes(12).toString('base64url')}7a`;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(
    `UPDATE usuario
        SET password_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL, version_sesion = version_sesion + 1
      WHERE lower(correo) = $1
      RETURNING id`,
    [correo, await bcrypt.hash(passwordTemporal, 12)],
  );
  if (!rows[0]) {
    console.error(`No hay ninguna cuenta con el correo ${correo} en esta base.`);
    process.exitCode = 1;
  } else {
    // Los bloqueos por IP de esa cuenta también se levantan
    await db.query('DELETE FROM bloqueo_inicio WHERE usuario_id = $1', [rows[0].id]).catch(() => {});
    console.log('✔ Contraseña restablecida.');
    console.log(`  Correo:                ${correo}`);
    console.log(`  Contraseña temporal:   ${passwordTemporal}`);
    console.log('  Guárdala ahora: no se vuelve a mostrar. Al entrar, cámbiala en "Mi perfil".');
  }
} catch (error) {
  console.error(error.code === 'ECONNREFUSED' ? 'No hay conexión con PostgreSQL: enciéndelo con npm run db.' : error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
