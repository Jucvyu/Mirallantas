import { query } from '../db.js';

/**
 * Modelo del límite de peticiones (tabla `cubo_fichas`, migración 0026).
 * Cada cubo guarda las fichas que le quedan y la hora de la última recarga.
 */

/** Gasta una ficha del cubo `clave`. Devuelve { permitida, fichas }. */
export async function consumir(clave, { capacidad, porMinuto }) {
  const { rows } = await query('SELECT permitida, fichas FROM consumir_ficha($1, $2, $3)', [
    clave,
    capacidad,
    porMinuto / 60,
  ]);
  return rows[0];
}

/** Borra los cubos sin uso desde hace una hora: ya estarían llenos y se recrean solos. */
export async function borrarInactivos() {
  await query("DELETE FROM cubo_fichas WHERE ultima_recarga < now() - interval '1 hour'");
}
