import bcrypt from 'bcryptjs';

/**
 * Contraseñas: nunca se guardan tal cual, solo su hash bcrypt.
 *
 * El costo (12) es cuántas vueltas da bcrypt: más alto = más lento para
 * quien intente adivinarlas con una copia robada de la base.
 */
const COSTO = 12;

export const cifrarPassword = (password) => bcrypt.hash(password, COSTO);

export const compararPassword = (password, hash) => bcrypt.compare(password, hash);

// Hash de relleno: si el correo no existe se compara igual contra este,
// para que el tiempo de respuesta no revele qué correos están registrados.
export const HASH_RELLENO = bcrypt.hashSync('relleno-que-nunca-coincide', COSTO);
