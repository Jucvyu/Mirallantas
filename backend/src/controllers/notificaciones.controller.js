import * as avisos from '../models/notificacionesPersonal.model.js';
import { enviarDato, enviarSinContenido } from '../views/respuesta.view.js';

/**
 * Controlador de los avisos del personal (/api/notificaciones).
 *
 * Cada aviso pertenece a un módulo; el usuario solo recibe los de los
 * módulos que su rol tiene permitidos. Por ahora el único módulo que avisa
 * es Pedidos-Cotización.
 */
export const MODULOS_CON_AVISOS = ['Pedidos-Cotización'];

const modulosDe = (req) => MODULOS_CON_AVISOS.filter((m) => req.usuario.permisos.has(m));

/** GET /notificaciones — los avisos recientes y cuántos faltan por ver. */
export async function listar(req, res) {
  const modulos = modulosDe(req);
  if (modulos.length === 0) return enviarDato(res, { notificaciones: [], sinLeer: 0 });
  enviarDato(res, await avisos.listar(req.usuario.id, modulos));
}

/** POST /notificaciones/leidas — al abrir la campana. */
export async function marcarLeidas(req, res) {
  await avisos.marcarLeidas(req.usuario.id);
  enviarSinContenido(res);
}
