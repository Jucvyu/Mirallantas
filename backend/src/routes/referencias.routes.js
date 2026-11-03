import { Router } from 'express';
import * as controlador from '../controllers/referencias.controller.js';

/**
 * Rutas de las listas del sistema (/api/referencias).
 *
 *   GET /   tipos de documento y métodos de pago
 */
export const rutasReferencias = Router();

rutasReferencias.get('/', controlador.listar);
