import { Router } from 'express';
import * as controlador from '../controllers/empresa.controller.js';
import { autenticar } from '../middleware/auth.js';

/**
 * Rutas de la empresa (/api/empresa).
 *
 *   GET /   cualquier usuario con sesión (la usan los comprobantes)
 *
 * El módulo para editarlos se retiró del panel; los datos se registran
 * directamente en la tabla `empresa` (fila id = 1).
 */
export const rutasEmpresa = Router();
rutasEmpresa.use(autenticar);

rutasEmpresa.get('/', controlador.obtener);
