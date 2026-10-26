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

/** POST /notificaciones/leidas — al abrir la campana. */
export async function marcarLeidas(req, res) {
  await avisos.marcarLeidas(req.usuario.id);
  enviarSinContenido(res);
}
