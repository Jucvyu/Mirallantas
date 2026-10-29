import { POOL } from './listado.model.js';

/**
 * Consultas de la tabla `cliente` que usan otros módulos (registro de
 * cuentas, perfil, cotizaciones). El CRUD del módulo Clientes lo hace el
 * modelo genérico de catálogos (catalogos.model.js).
 */

/**
 * Clientes que se pueden elegir en los formularios: solo las fichas con una
 * cuenta de usuario ACTIVA de rol Cliente (los clientes se crean desde
 * Usuarios). Trae el documento para distinguir dos nombres parecidos.
 */
export async function seleccionables() {
  const { rows } = await POOL.query(
    `SELECT c.id, c.nombre_completo AS "nombreCompleto",
            c.tipo_documento AS "tipoDocumento", c.numero_documento AS "numeroDocumento",
            c.telefono, c.correo, c.direccion
       FROM cliente c
      WHERE c.activo
        AND EXISTS (
          SELECT 1 FROM usuario u JOIN rol r ON r.id = u.rol_id
           WHERE u.cliente_id = c.id AND r.nombre = 'Cliente' AND u.activo
        )
      ORDER BY c.nombre_completo, c.id`,
  );
  return rows;
}

/** Id del cliente con ese documento, o null si no existe. */
export async function idPorDocumento(db, tipoDocumento, numeroDocumento) {
  const { rows } = await db.query('SELECT id FROM cliente WHERE tipo_documento = $1 AND numero_documento = $2', [
    tipoDocumento,
    numeroDocumento,
  ]);
  return rows[0]?.id ?? null;
}

/** Crea la ficha de un cliente y devuelve su id. */
export async function crear(db, c) {
  const { rows } = await db.query(
    `INSERT INTO cliente (tipo_documento, numero_documento, nombre_completo, telefono, correo, direccion)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [c.tipoDocumento, c.numeroDocumento, c.nombre, c.telefono ?? null, c.correo, c.direccion ?? null],
  );
  return rows[0].id;
}

/**
 * Actualiza los datos de contacto que el cliente puede cambiar desde su
 * perfil. Los que lleguen como null se dejan como estaban.
 */
export async function actualizarContacto(db, clienteId, { nombre, telefono, correo, direccion }) {
  await db.query(
    `UPDATE cliente SET
       nombre_completo = COALESCE($1, nombre_completo), telefono = COALESCE($2, telefono),
       correo = COALESCE($3, correo), direccion = COALESCE($4, direccion)
     WHERE id = $5`,
    [nombre ?? null, telefono ?? null, correo ?? null, direccion ?? null, clienteId],
  );
}

/** ¿El cliente existe y está activo? */
export async function estaActivo(db, clienteId) {
  const { rows } = await db.query('SELECT activo FROM cliente WHERE id = $1', [clienteId]);
  return Boolean(rows[0]?.activo);
}

/** Número del crédito abierto (con saldo) del cliente, o null. */
export async function creditoAbierto(db, clienteId) {
  const { rows } = await (db ?? POOL).query(
    'SELECT numero FROM credito WHERE cliente_id = $1 AND saldo_pendiente > 0',
    [clienteId],
  );
  return rows[0]?.numero ?? null;
}

/** Datos del cliente que se imprimen en los documentos (cotización y comprobante). */
export async function paraDocumento(id, db = POOL) {
  const { rows } = await db.query(
    `SELECT nombre_completo AS nombre, tipo_documento AS "tipoDocumento", numero_documento AS "numeroDocumento",
            direccion, telefono, correo
       FROM cliente WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
