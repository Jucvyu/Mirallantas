import { Router } from 'express';
import * as controlador from '../controllers/compras.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaCambio, esquemaListado, esquemaNueva } from '../validators/compras.validator.js';

/**
 * Rutas de compras (/api/compras), solo para el personal interno.
 *
 *   GET    /             listado
 *   GET    /:numero      detalle con sus líneas
 *   POST   /             registra una orden de compra
 *   PATCH  /:numero      cambia estado (recibir o anular) o la entrega
 */
export const rutasCompras = Router();
rutasCompras.use(autenticar, soloPersonal, requierePermiso('Compras'));

rutasCompras.get('/', validar(esquemaListado, 'query'), controlador.listar);
rutasCompras.get('/:numero', controlador.obtener);
rutasCompras.post('/', validar(esquemaNueva), controlador.crear);
rutasCompras.patch('/:numero', validar(esquemaCambio), controlador.actualizar);
