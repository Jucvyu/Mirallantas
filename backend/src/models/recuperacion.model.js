import { query } from '../db.js';

/**
 * Modelo de "¿Olvidaste tu contraseña?" (tablas `recuperacion_password` y
 * `bloqueo_recuperacion`). Solo SQL: las reglas están en el controlador.
 *
 * De cada enlace se guarda solo la huella (HMAC) de su token, nunca el
 * token: quien lea la base no puede usar un enlace vigente.
 */

/** Solicitudes por IP antes de esperar (existan o no los correos). */
export const SOLICITUDES_POR_IP = 5;
/** Minutos que dura la espera de la IP. */
export const MINUTOS_BLOQUEO = 15;
/** Minutos que vale un enlace de recuperación. */
export const MINUTOS_VIGENCIA = 30;

// ---- Límite por IP ----------------------------------------------------------

/**
 * Cuenta una solicitud de la IP. Devuelve true si todavía puede pedir
 * enlaces; al agotar las 5 queda esperando 15 minutos.
 */
export async function contarSolicitudIp(ip) {
  const { rows } = await query(
    `INSERT INTO bloqueo_recuperacion (ip, intentos_restantes) VALUES ($1, $2 - 1)
     ON CONFLICT (ip) DO UPDATE SET
       intentos_restantes = CASE
         WHEN bloqueo_recuperacion.bloqueado_hasta IS NOT NULL AND bloqueo_recuperacion.bloqueado_hasta <= now()
           THEN $2 - 1
         ELSE bloqueo_recuperacion.intentos_restantes - 1
       END,
       bloqueado_hasta = CASE
         WHEN bloqueo_recuperacion.bloqueado_hasta IS NOT NULL AND bloqueo_recuperacion.bloqueado_hasta <= now()
           THEN NULL
         ELSE bloqueo_recuperacion.bloqueado_hasta
       END
     RETURNING intentos_restantes, bloqueado_hasta`,
    [ip, SOLICITUDES_POR_IP],
  );
  const fila = rows[0];
  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) return false;
  if (fila.intentos_restantes < 0) {
    await query(
      `UPDATE bloqueo_recuperacion SET bloqueado_hasta = now() + make_interval(mins => $2) WHERE ip = $1`,
      [ip, MINUTOS_BLOQUEO],
    );
    return false;
  }
  return true;
}

// ---- Enlaces ------------------------------------------------------------------

/**
 * Guarda un enlace nuevo (la huella de su token) y anula los anteriores
 * del mismo usuario: solo vale el último enlace enviado. Devuelve su id.
 */
export async function crear(usuarioId, tokenHash) {
  await query('UPDATE recuperacion_password SET usado = TRUE WHERE usuario_id = $1 AND NOT usado', [usuarioId]);
  const { rows } = await query(
    `INSERT INTO recuperacion_password (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, now() + make_interval(mins => $3))
     RETURNING id`,
    [usuarioId, tokenHash, MINUTOS_VIGENCIA],
  );
  return rows[0].id;
}

/** Anula un enlace (p. ej. si el correo no se pudo enviar). */
export async function anular(id) {
  await query('UPDATE recuperacion_password SET usado = TRUE WHERE id = $1', [id]);
}

/**
 * Enlace vigente (sin usar y sin vencer) con esa huella, o null. Con `db`
 * y `bloquear` queda bloqueado hasta terminar la transacción: dos envíos a
 * la vez del mismo enlace no cambian la contraseña dos veces.
 */
export async function buscarVigente(tokenHash, { db, bloquear = false } = {}) {
  const { rows } = await (db ?? { query }).query(
    `SELECT r.id, r.usuario_id, u.correo, u.nombre
       FROM recuperacion_password r
       JOIN usuario u ON u.id = r.usuario_id
      WHERE r.token_hash = $1 AND NOT r.usado AND r.expira_en > now() AND u.activo
      ${bloquear ? 'FOR UPDATE OF r' : ''}`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

/** La contraseña ya se cambió: el enlace no vuelve a servir. */
export async function marcarUsada(db, id) {
  await db.query('UPDATE recuperacion_password SET usado = TRUE WHERE id = $1', [id]);
}
