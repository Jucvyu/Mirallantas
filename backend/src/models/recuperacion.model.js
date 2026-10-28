import { query } from '../db.js';

/**
 * Modelo de "¿Olvidaste tu contraseña?" (tablas `recuperacion_password` y
 * `bloqueo_recuperacion`). Solo SQL: las reglas están en el controlador.
 */

/** Solicitudes de código por IP (exista o no el correo) antes del bloqueo. */
export const INTENTOS_CORREO = 5;
/** Intentos para escribir bien el código recibido. */
export const INTENTOS_CODIGO = 3;
/** Minutos que dura el bloqueo: después la IP recupera todos sus intentos. */
export const MINUTOS_BLOQUEO = 1;
/** Minutos que vale el código (y, ya verificado, el cambio de contraseña). */
export const MINUTOS_VIGENCIA = 10;

// ---- Bloqueo por IP ----------------------------------------------------------

/**
 * Estado que se envía al navegador. Incluye los segundos que faltan,
 * calculados aquí: así el contador no depende del reloj del computador
 * del usuario.
 */
const estadoBloqueado = (bloqueadoHasta) => ({
  intentosRestantes: 0,
  bloqueadoHasta,
  segundosRestantes: Math.max(1, Math.ceil((new Date(bloqueadoHasta) - Date.now()) / 1000)),
});

/**
 * Estado de una IP: { intentosRestantes, bloqueadoHasta }. Si el bloqueo ya
 * pasó, la IP vuelve a tener todos sus intentos.
 */
export async function estadoIp(ip) {
  const { rows } = await query(
    `SELECT intentos_restantes, bloqueado_hasta FROM bloqueo_recuperacion WHERE ip = $1`,
    [ip],
  );
  const fila = rows[0];
  if (!fila) return { intentosRestantes: INTENTOS_CORREO, bloqueadoHasta: null };
  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
    return estadoBloqueado(fila.bloqueado_hasta);
  }
  if (fila.bloqueado_hasta) {
    // El bloqueo terminó: se reinicia
    await reiniciarIp(ip);
    return { intentosRestantes: INTENTOS_CORREO, bloqueadoHasta: null };
  }
  return { intentosRestantes: fila.intentos_restantes, bloqueadoHasta: null };
}

/**
 * Descuenta un intento a la IP. Al llegar a cero la bloquea MINUTOS_BLOQUEO.
 * Devuelve el estado nuevo.
 */
export async function descontarIntentoIp(ip) {
  const { rows } = await query(
    `INSERT INTO bloqueo_recuperacion (ip, intentos_restantes) VALUES ($1, $2 - 1)
     ON CONFLICT (ip) DO UPDATE SET intentos_restantes = bloqueo_recuperacion.intentos_restantes - 1
     RETURNING intentos_restantes`,
    [ip, INTENTOS_CORREO],
  );
  if (rows[0].intentos_restantes > 0) return { intentosRestantes: rows[0].intentos_restantes, bloqueadoHasta: null };
  return bloquearIp(ip);
}

/** Bloquea la IP MINUTOS_BLOQUEO (intentos agotados o código errado 3 veces). */
export async function bloquearIp(ip) {
  const { rows } = await query(
    `INSERT INTO bloqueo_recuperacion (ip, intentos_restantes, bloqueado_hasta)
     VALUES ($1, 0, now() + make_interval(mins => $2))
     ON CONFLICT (ip) DO UPDATE SET intentos_restantes = 0, bloqueado_hasta = EXCLUDED.bloqueado_hasta
     RETURNING bloqueado_hasta`,
    [ip, MINUTOS_BLOQUEO],
  );
  return estadoBloqueado(rows[0].bloqueado_hasta);
}

/** Devuelve a la IP todos sus intentos (ya cambió su contraseña). */
export async function reiniciarIp(ip) {
  await query('DELETE FROM bloqueo_recuperacion WHERE ip = $1', [ip]);
}

// ---- Solicitudes ---------------------------------------------------------------

/**
 * Crea una solicitud con el hash del código y anula las anteriores del
 * mismo usuario (solo vale el último código enviado). Devuelve su id.
 */
export async function crear(usuarioId, codigoHash) {
  await query('UPDATE recuperacion_password SET usado = TRUE WHERE usuario_id = $1 AND NOT usado', [usuarioId]);
  const { rows } = await query(
    `INSERT INTO recuperacion_password (usuario_id, codigo_hash, intentos_restantes, expira_en)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))
     RETURNING id, expira_en`,
    [usuarioId, codigoHash, INTENTOS_CODIGO, MINUTOS_VIGENCIA],
  );
  return rows[0];
}

/** Solicitud vigente (sin usar y sin vencer), o null. */
export async function buscarVigente(id) {
  const { rows } = await query(
    `SELECT id, usuario_id, codigo_hash, intentos_restantes, verificado
       FROM recuperacion_password
      WHERE id = $1 AND NOT usado AND expira_en > now()`,
    [id],
  );
  return rows[0] ?? null;
}

/** Descuenta un intento al código. Devuelve los que quedan (0 = se anula). */
export async function descontarIntentoCodigo(id) {
  const { rows } = await query(
    `UPDATE recuperacion_password
        SET intentos_restantes = intentos_restantes - 1,
            usado = intentos_restantes - 1 <= 0
      WHERE id = $1
      RETURNING intentos_restantes`,
    [id],
  );
  return rows[0].intentos_restantes;
}

/** Código correcto: queda verificada y con 10 minutos para cambiar la contraseña. */
export async function marcarVerificada(id) {
  await query(
    `UPDATE recuperacion_password SET verificado = TRUE, expira_en = now() + make_interval(mins => $2) WHERE id = $1`,
    [id, MINUTOS_VIGENCIA],
  );
}

/** La contraseña ya se cambió: la solicitud no vuelve a servir. */
export async function marcarUsada(db, id) {
  await db.query('UPDATE recuperacion_password SET usado = TRUE WHERE id = $1', [id]);
}
