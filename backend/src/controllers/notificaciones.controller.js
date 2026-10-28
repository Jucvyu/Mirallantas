import { HttpError } from '../errores.js';
import * as avisos from '../models/notificacionesPersonal.model.js';
import { enviarDato, enviarSinContenido } from '../views/respuesta.view.js';

/**
 * Controlador de los avisos del personal (/api/notificaciones).
 *
 * Cada aviso pertenece a un módulo (permiso); el usuario solo recibe los de
 * los módulos que su rol tiene permitidos. El menú lateral muestra, en cada
 * módulo, una burbuja con los avisos nuevos que llevan a él.
 */
export const MODULOS_CON_AVISOS = ['Pedidos-Cotización', 'Solicitudes de servicio', 'Cartera', 'Abonos', 'Compras'];

const modulosDe = (req) => MODULOS_CON_AVISOS.filter((m) => req.usuario.permisos.has(m));

/** GET /notificaciones — los avisos recientes y cuántos faltan por ver. */
export async function listar(req, res) {
  const modulos = modulosDe(req);
  if (modulos.length === 0) return enviarDato(res, { notificaciones: [], sinLeer: 0 });
  enviarDato(res, await avisos.listar(req.usuario.id, modulos));
}

/** GET /notificaciones/por-modulo — avisos nuevos por ruta, para el menú lateral. */
export async function porModulo(req, res) {
  const modulos = modulosDe(req);
  if (modulos.length === 0) return enviarDato(res, {});
  enviarDato(res, await avisos.porRuta(req.usuario.id, modulos));
}

/** POST /notificaciones/vista — el usuario entró a un módulo. */
export async function marcarVista(req, res) {
  await avisos.marcarRutaVista(req.usuario.id, req.validado.body.ruta);
  enviarSinContenido(res);
}

/** DELETE /notificaciones/:id — borra un aviso (solo para este usuario). */
export async function borrarUna(req, res) {
  const borradas = await avisos.borrar(req.usuario.id, modulosDe(req), req.validado.params.id);
  if (!borradas) throw new HttpError(404, 'El aviso no existe o ya lo borraste.');
  enviarSinContenido(res);
}

/** DELETE /notificaciones — borra todos los avisos que ve este usuario. */
export async function borrarTodas(req, res) {
  await avisos.borrar(req.usuario.id, modulosDe(req));
  enviarSinContenido(res);
}

/** POST /notificaciones/leidas — al abrir la campana. */
export async function marcarLeidas(req, res) {
  await avisos.marcarLeidas(req.usuario.id);
  enviarSinContenido(res);
}
