import { Router } from 'express';
import * as controlador from '../controllers/productos.controller.js';
import { autenticar, requierePermiso } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaId } from '../validators/comunes.validator.js';
import { esquemaEdicion, esquemaFiltros, esquemaNuevo } from '../validators/productos.validator.js';

/**
 * Rutas de productos (/api/productos).
 *
 *   GET  /       catálogo (cualquiera con sesión; el portal solo ve activos)
 *   GET  /:id    un producto con sus imágenes
 *   POST /       crea un producto                    (permiso "Productos")
 *   PUT  /:id    actualiza; también activa/desactiva (permiso "Productos")
 */
export const rutasProductos = Router();
rutasProductos.use(autenticar);

rutasProductos.get('/', validar(esquemaFiltros, 'query'), controlador.listar);
rutasProductos.get('/:id', validar(esquemaId, 'params'), controlador.obtener);
rutasProductos.post('/', requierePermiso('Productos'), validar(esquemaNuevo), controlador.crear);
rutasProductos.put(
  '/:id',
  requierePermiso('Productos'),
  validar(esquemaId, 'params'),
  validar(esquemaEdicion),
  controlador.actualizar,
);
