import { Router } from 'express';
import * as controlador from '../controllers/ventas.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaCambio, esquemaListado, esquemaNueva } from '../validators/ventas.validator.js';

/**
 * Rutas de ventas (/api/ventas).
 *
 *   GET    /             listado (el portal solo ve las suyas)
 *   GET    /:numero      detalle con sus líneas
 *   POST   /             registra una venta directa (sin cotización)
 *   PATCH  /:numero      cambia estado (p. ej. anular), entrega o datos de apoyo
 */
export const rutasVentas = Router();
rutasVentas.use(autenticar, requierePermiso('Ventas'));

rutasVentas.get('/', validar(esquemaListado, 'query'), controlador.listar);
rutasVentas.get('/:numero', controlador.obtener);
rutasVentas.post('/', soloPersonal, validar(esquemaNueva), controlador.crear);
rutasVentas.patch('/:numero', soloPersonal, validar(esquemaCambio), controlador.actualizar);
