import { query } from '../db.js';

/**
 * Modelo de la bitácora de seguridad (tabla `evento_seguridad`).
 *
 * Guarda inicios de sesión, intentos fallidos, bloqueos, accesos negados y
 * cambios del doble factor, con la IP y el navegador. Se consulta
 * directamente en la base (tabla evento_seguridad).
 */

/** Recorta textos largos que vienen del cliente (navegador, detalle). */
const recortar = (texto, largo) => (texto ? String(texto).slice(0, largo) : null);

/**
 * Registra un evento. Nunca hace fallar la petición: si la bitácora no se
 * puede escribir, solo se avisa en el log.
 */
export async function registrar({ tipo, gravedad = 'Info', usuarioId = null, correo = null, ip, agente, detalle = null }) {
  try {
    await query(
      `INSERT INTO evento_seguridad (tipo, gravedad, usuario_id, correo, ip, agente, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tipo, gravedad, usuarioId, recortar(correo, 150), recortar(ip, 60), recortar(agente, 300), recortar(detalle, 500)],
    );
  } catch (error) {
    console.error('No se pudo registrar el evento de seguridad:', error.message);
  }
}

/** ¿El usuario ya había iniciado sesión antes desde esta IP? */
export async function ipConocida(usuarioId, ip) {
  const { rows } = await query(
    `SELECT 1 FROM evento_seguridad WHERE usuario_id = $1 AND ip = $2 AND tipo = 'inicio_sesion' LIMIT 1`,
    [usuarioId, ip],
  );
  return rows.length > 0;
}
