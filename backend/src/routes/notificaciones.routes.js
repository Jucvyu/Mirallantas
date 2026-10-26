import { Router } from 'express';
import { z } from 'zod';
import * as controlador from '../controllers/notificaciones.controller.js';
import { autenticar, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';

/**
 * Avisos del personal (/api/notificaciones). Los del cliente están en
 * /api/portal/notificaciones.
 *
 *   GET  /            avisos de los módulos permitidos y cuántos faltan por ver
 *   GET  /por-modulo  avisos nuevos de cada módulo (burbujas del menú)
 *   POST /vista       el usuario entró a un módulo ({ ruta })
 *   POST /leidas      marcarlos como vistos
 */

const esquemaVista = z.object({
  ruta: z.string().trim().regex(/^\/admin\/[a-z-]{1,40}$/, 'Ruta no válida.'),
});

export const rutasNotificaciones = Router();
rutasNotificaciones.use(autenticar, soloPersonal);

rutasNotificaciones.get('/', controlador.listar);
rutasNotificaciones.get('/por-modulo', controlador.porModulo);
rutasNotificaciones.post('/vista', validar(esquemaVista), controlador.marcarVista);
rutasNotificaciones.post('/leidas', controlador.marcarLeidas);
