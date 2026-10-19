import { Router } from 'express';
import * as controlador from '../controllers/notificaciones.controller.js';
import { autenticar, soloPersonal } from '../middleware/auth.js';

/**
 * Avisos del personal (/api/notificaciones). Los del cliente están en
 * /api/portal/notificaciones.
 *
 *   GET  /          avisos de los módulos permitidos y cuántos faltan por ver
 *   POST /leidas    marcarlos como vistos
 */
export const rutasNotificaciones = Router();
rutasNotificaciones.use(autenticar, soloPersonal);

rutasNotificaciones.get('/', controlador.listar);
rutasNotificaciones.post('/leidas', controlador.marcarLeidas);
