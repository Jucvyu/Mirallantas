/**
 * Deja la base lista para empezar a operar: borra todos los datos de
 * negocio (clientes, productos, cotizaciones, ventas, créditos…) y deja
 * solo las cuentas de Administrador, los roles Administrador y Cliente,
 * los permisos y las listas del sistema (tipos de documento, métodos y
 * medios de pago, tipos de vehículo).
 *
 *   npm run db:limpiar -- --confirmar
 *
 * ⚠ No se puede deshacer. Antes saca una copia: npm run db:respaldo
 */
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Tablas que se vacían por completo, en orden: primero las que dependen de
 * otras (detalles, abonos…) y al final las principales.
 */
const TABLAS_DE_NEGOCIO = [
  'abono',
  'solicitud_credito',
  'credito',
  'venta_detalle',
  'venta',
  'compra_detalle',
  'compra',
  'cotizacion_detalle',
  'cotizacion',
  'solicitud_servicio',
  'producto_imagen',
  'producto',
  'categoria',
  'marca',
  'proveedor',
  'tercero',
  'consecutivo',
  'evento_seguridad',
  'notificacion',
  'recuperacion_password',
  'bloqueo_recuperacion',
];

export async function limpiar(connectionString) {
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await db.query('BEGIN');
    for (const tabla of TABLAS_DE_NEGOCIO) await db.query(`DELETE FROM ${tabla}`);

    // Servicios: solo queda el del sistema ("Reencauche")
    await db.query("DELETE FROM servicio WHERE nombre <> 'Reencauche'");

    // Cuentas: solo quedan las del rol Administrador
    await db.query(`DELETE FROM usuario WHERE rol_id NOT IN (SELECT id FROM rol WHERE nombre = 'Administrador')`);
    await db.query('UPDATE usuario SET cliente_id = NULL');
    await db.query('DELETE FROM cliente');

    // Roles: solo los del sistema
    await db.query(`DELETE FROM rol_permiso WHERE rol_id IN (SELECT id FROM rol WHERE nombre NOT IN ('Administrador', 'Cliente'))`);
    await db.query(`DELETE FROM rol WHERE nombre NOT IN ('Administrador', 'Cliente')`);

    const { rows } = await db.query(
      `SELECT u.correo FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'Administrador' ORDER BY u.id`,
    );
    await db.query('COMMIT');
    return rows.map((r) => r.correo);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

// Uso desde la línea de comandos
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { confirmar: { type: 'boolean', default: false } } });
  if (!values.confirmar) {
    console.error('Esto borra todos los datos de negocio y no se puede deshacer.');
    console.error('Saca antes una copia (npm run db:respaldo) y repite con: npm run db:limpiar -- --confirmar');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Copia backend/.env.example como backend/.env (o usa database/.env).');
    process.exit(1);
  }
  limpiar(process.env.DATABASE_URL)
    .then((admins) => {
      console.log('✔ Base limpia. Cuentas que quedan (Administrador):');
      for (const correo of admins) console.log(`   ${correo}`);
    })
    .catch((error) => {
      // Sin servidor, pg lanza un error sin mensaje: se explica qué pasó
      console.error(error.code === 'ECONNREFUSED' ? 'No hay conexión con PostgreSQL: enciéndelo con npm run db.' : error.message);
      process.exit(1);
    });
}
