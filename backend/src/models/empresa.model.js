import { query } from '../db.js';

/**
 * Modelo de la empresa (tabla `empresa`, una sola fila con id = 1).
 * Nace vacía: los datos reales los registra un administrador.
 */

const SELECCION = `
  nombre, razon_social AS "razonSocial", nit, direccion, ciudad, telefono, correo,
  logo_url AS "logoUrl", actualizado_en AS "actualizadoEn"`;

/** Datos de la empresa, o null si todavía no se han registrado. */
export async function obtener() {
  const { rows } = await query(`SELECT ${SELECCION} FROM empresa WHERE id = 1`);
  return rows[0] ?? null;
}
