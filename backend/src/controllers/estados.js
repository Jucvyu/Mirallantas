import { HttpError } from '../errores.js';
import { estaActivo, POOL } from '../models/listado.model.js';

/**
 * Regla común de los estados Activo / Inactivo: un registro inactivo se
 * conserva (con su historial), pero no se puede usar en registros nuevos.
 * Por ejemplo, no se vende a un cliente inactivo ni se crea un producto en
 * una categoría inactiva.
 */
const NOMBRES = {
  cliente: ['El cliente', 'inactivo'],
  proveedor: ['El proveedor', 'inactivo'],
  categoria: ['La categoría', 'inactiva'],
  marca: ['La marca', 'inactiva'],
  servicio: ['El servicio', 'inactivo'],
  producto: ['El producto', 'inactivo'],
};

/** Lanza un error claro si el registro no existe o está inactivo. */
export async function exigirActivo(tabla, id, db = POOL) {
  if (id === undefined || id === null) return;
  const activo = await estaActivo(db, tabla, id);
  const [nombre, inactivo] = NOMBRES[tabla];
  if (activo === null) throw new HttpError(422, `${nombre} seleccionado no existe.`);
  if (!activo) throw new HttpError(422, `${nombre} está ${inactivo}: actívalo antes de usarlo.`);
}
