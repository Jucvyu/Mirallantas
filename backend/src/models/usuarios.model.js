import { query } from '../db.js';
import { actualizarCampos, POOL } from './listado.model.js';

/**
 * Modelo de usuarios (tabla `usuario`).
 *
 * Solo consultas SQL: buscar, crear, actualizar y eliminar cuentas. Las
 * reglas (quién puede hacer qué, cifrar la contraseña) están en los
 * controladores.
 */

/** Nombres de la API → columnas de la tabla `usuario`. */
export const COLUMNAS = {
  nombre: 'nombre',
  tipoDocumento: 'tipo_documento',
  numeroDocumento: 'numero_documento',
  correo: 'correo',
  telefono: 'telefono',
  rolId: 'rol_id',
  activo: 'activo',
};

const SELECT_USUARIO = `
  u.id, u.nombre, u.tipo_documento AS "tipoDocumento", u.numero_documento AS "numeroDocumento",
  u.correo, u.telefono, u.rol_id AS "rolId", r.nombre AS rol, u.cliente_id AS "clienteId", u.activo,
  u.totp_activo AS "dosFactores", u.ultimo_acceso AS "ultimoAcceso",
  -- El primer Administrador creado está protegido (no se desactiva ni se elimina)
  u.id = (SELECT MIN(u2.id) FROM usuario u2 JOIN rol r2 ON r2.id = u2.rol_id WHERE r2.nombre = 'Administrador') AS principal`;

/**
 * Cuenta con sus permisos, esté activa o no. Busca por id o por correo.
 * Trae también si la cuenta, su rol y (en el portal) su ficha de cliente
 * están activos, para poder avisar "tu cuenta está inactiva".
 * Incluye el hash de la contraseña y el secreto del doble factor: NUNCA
 * deben salir en una respuesta (la vista se encarga de quitarlos).
 */
export async function buscarCuenta({ id, correo }) {
  const [condicion, valor] = id ? ['u.id = $1', id] : ['LOWER(u.correo) = $1', correo];
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.correo, u.password_hash, u.cliente_id,
            u.tipo_documento, u.numero_documento, u.telefono, u.foto_url,
            u.version_sesion, u.intentos_fallidos, u.bloqueado_hasta, u.totp_secreto, u.totp_activo,
            u.ultimo_acceso, u.ultima_ip,
            cl.direccion, r.nombre AS rol,
            u.activo, r.activo AS rol_activo, cl.activo AS cliente_activo,
            COALESCE(array_agg(p.modulo ORDER BY p.modulo) FILTER (WHERE p.modulo IS NOT NULL), '{}') AS permisos
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN cliente cl ON cl.id = u.cliente_id
       LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
       LEFT JOIN permiso p ON p.id = rp.permiso_id
      WHERE ${condicion}
      GROUP BY u.id, r.nombre, r.activo, cl.id`,
    [valor],
  );
  return rows[0] ?? null;
}

/**
 * ¿La cuenta puede usar el sistema? Deben estar activos el usuario, su rol
 * y, si es del portal, su ficha de cliente.
 */
export const cuentaHabilitada = (u) => u.activo && u.rol_activo && u.cliente_activo !== false;

/** Usuario habilitado (activo, con rol activo), o null. */
export async function buscarSesion(filtro) {
  const usuario = await buscarCuenta(filtro);
  return usuario && cuentaHabilitada(usuario) ? usuario : null;
}

/** Listado paginado con búsqueda por nombre, correo o documento. */
export async function listar({ q, pagina, porPagina }) {
  const valores = q ? [`%${q}%`] : [];
  const where = q ? 'WHERE u.nombre ILIKE $1 OR u.correo ILIKE $1 OR u.numero_documento ILIKE $1' : '';
  const total = await query(`SELECT COUNT(*)::int AS n FROM usuario u ${where}`, valores);
  const { rows } = await query(
    `SELECT ${SELECT_USUARIO} FROM usuario u JOIN rol r ON r.id = u.rol_id
       ${where}
      ORDER BY u.nombre, u.id
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, porPagina, (pagina - 1) * porPagina],
  );
  return { filas: rows, total: total.rows[0].n };
}

/** Un usuario por id (sin el hash de la contraseña). */
export async function buscarPorId(id) {
  const { rows } = await query(`SELECT ${SELECT_USUARIO} FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}

/** Crea una cuenta. `passwordHash` ya viene cifrado. Devuelve el id. */
export async function crear(db, u) {
  const { rows } = await db.query(
    `INSERT INTO usuario (nombre, tipo_documento, numero_documento, correo, telefono, password_hash, rol_id, cliente_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [u.nombre, u.tipoDocumento, u.numeroDocumento, u.correo, u.telefono ?? null, u.passwordHash, u.rolId, u.clienteId ?? null],
  );
  return rows[0].id;
}

/** Actualiza las columnas indicadas: pares [['columna', valor], …]. */
export function actualizar(db, id, pares) {
  return actualizarCampos(db, 'usuario', id, pares);
}

/** Elimina una cuenta. Devuelve true si existía. */
export async function eliminar(id, db = POOL) {
  const { rowCount } = await db.query('DELETE FROM usuario WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---- Seguridad de la sesión --------------------------------------------------

/** Intentos fallidos seguidos que bloquean la cuenta. */
export const MAXIMO_INTENTOS = 5;
/** Minutos que dura el bloqueo. */
export const MINUTOS_BLOQUEO = 15;

/**
 * Suma un intento fallido. Al llegar al máximo bloquea la cuenta unos
 * minutos y reinicia el contador. Devuelve true si quedó bloqueada.
 */
export async function registrarFallo(id) {
  const { rows } = await query(
    `UPDATE usuario
        SET intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END,
            bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2
                                     THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END
      WHERE id = $1
      RETURNING bloqueado_hasta > now() AS bloqueado`,
    [id, MAXIMO_INTENTOS, MINUTOS_BLOQUEO],
  );
  return rows[0]?.bloqueado ?? false;
}

/** Inicio de sesión correcto: limpia los fallos y guarda la IP. */
export async function registrarAcceso(id, ip) {
  await query(
    `UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now(), ultima_ip = $2
      WHERE id = $1`,
    [id, ip],
  );
}

/** Invalida todos los tokens emitidos al usuario (cierre de sesión global). */
export async function subirVersionSesion(id, db = POOL) {
  await db.query('UPDATE usuario SET version_sesion = version_sesion + 1 WHERE id = $1', [id]);
}

/** Guarda el secreto del doble factor (ya cifrado) y si está activo. */
export async function guardarDobleFactor(id, { secretoCifrado, activo }) {
  await query('UPDATE usuario SET totp_secreto = $2, totp_activo = $3 WHERE id = $1', [id, secretoCifrado, activo]);
}

/** Administradores activos, sin contar a `excluirId`. */
export async function contarAdministradores(db, excluirId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre = 'Administrador' AND u.activo AND u.id <> $1`,
    [excluirId],
  );
  return rows[0].n;
}

// ---- Datos que no se repiten entre cuentas ---------------------------------------

/**
 * Bloquea (hasta terminar la transacción) las altas y cambios de cuentas,
 * para que dos registros al mismo tiempo no pasen ambos la revisión de
 * datos repetidos.
 */
export async function bloquearDatosUnicos(db) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext('usuario_datos_unicos'))");
}

/**
 * ¿Otra cuenta ya usa este correo, número de documento o teléfono? El
 * teléfono se compara solo por sus dígitos ("300 111 2233" = "3001112233").
 * `excluirId` es la cuenta que se está editando.
 */
export async function datoRepetido(db, { correo, numeroDocumento, telefono }, excluirId = null) {
  const { rows } = await db.query(
    `SELECT 1 FROM usuario
      WHERE id <> COALESCE($4, -1)
        AND (LOWER(correo) = LOWER($1)
             OR UPPER(numero_documento) = UPPER($2)
             OR ($3::text IS NOT NULL AND regexp_replace(telefono, '[^0-9]', '', 'g') = regexp_replace($3, '[^0-9]', '', 'g')))
      LIMIT 1`,
    [correo ?? '', numeroDocumento ?? '', telefono || null, excluirId],
  );
  return rows.length > 0;
}

/** Id del primer Administrador creado: no se desactiva, no se elimina, no cambia de rol. */
export async function idPrimerAdministrador(db = POOL) {
  const { rows } = await db.query(
    `SELECT MIN(u.id) AS id FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE r.nombre = 'Administrador'`,
  );
  return rows[0].id;
}
