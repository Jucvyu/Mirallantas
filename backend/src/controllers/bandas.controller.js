import { enTransaccion } from '../db.js';
import { noEncontrado } from '../errores.js';
import * as bandasModel from '../models/bandas.model.js';
import { enviarDato, enviarLista, enviarSinContenido } from '../views/respuesta.view.js';

/**
 * Controlador del catálogo de bandas de reencauche (personal interno).
 *
 * La banda es el producto del reencauche, pero no se vende sola: el cliente
 * la elige al pedir el reencauche y el asesor la confirma en la revisión.
 */

const QUE = 'La banda';

/** GET /bandas */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await bandasModel.listar(req.validado.query);
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/** GET /bandas/:id */
export async function obtener(req, res) {
  const banda = await bandasModel.buscarPorId(req.validado.params.id);
  if (!banda) throw noEncontrado(QUE);
  enviarDato(res, banda);
}

/** POST /bandas */
export async function crear(req, res) {
  const id = await enTransaccion((db) => bandasModel.crear(db, req.validado.body));
  enviarDato(res, await bandasModel.buscarPorId(id), 201);
}

/** PUT /bandas/:id */
export async function actualizar(req, res) {
  const { id } = req.validado.params;
  const existe = await enTransaccion((db) => bandasModel.actualizar(db, id, req.validado.body));
  if (!existe) throw noEncontrado(QUE);
  enviarDato(res, await bandasModel.buscarPorId(id));
}

/** PATCH /bandas/:id/estado — activa o desactiva (una inactiva no se ofrece). */
export async function cambiarEstado(req, res) {
  const { id } = req.validado.params;
  const existe = await enTransaccion((db) => bandasModel.actualizar(db, id, { activo: req.validado.body.activo }));
  if (!existe) throw noEncontrado(QUE);
  enviarDato(res, await bandasModel.buscarPorId(id));
}

/** DELETE /bandas/:id — si un reencauche ya la usa, se desactiva en vez de borrarse (409). */
export async function eliminar(req, res) {
  if (!(await bandasModel.eliminar(req.validado.params.id))) throw noEncontrado(QUE);
  enviarSinContenido(res);
}
