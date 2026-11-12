import { Router } from 'express';
import * as controlador from '../controllers/modelos.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaEstado } from '../validators/catalogos.validator.js';
import { esquemaId } from '../validators/comunes.validator.js';
import {
  esquemaEdicion,
  esquemaEdicionReferencia,
  esquemaFiltros,
  esquemaIdReferencia,
  esquemaNuevo,
  esquemaReferencia,
  esquemaReferenciasEnBloque,
} from '../validators/modelos.validator.js';

/**
 * Rutas de los modelos de llanta (/api/modelos), para el panel admin. El
 * portal y el catálogo público siguen usando /api/productos y /api/catalogo.
 *
 *   GET   /                                   modelos con búsqueda, filtros y conteo de medidas
 *   GET   /:id                                un modelo con sus medidas e imágenes
 *   POST  /                                   crea el modelo (ficha, foto y medidas iniciales)
 *   PUT   /:id                                actualiza el modelo (pasa a todas sus medidas)
 *   PATCH /:id/estado                         activa o desactiva el modelo
 *   POST  /:id/referencias                    agrega una medida
 *   PUT   /:id/referencias                    guarda todas las medidas (la tabla del panel)
 *   PUT   /:id/referencias/:referenciaId      edita una medida
 *   PATCH /:id/referencias/:referenciaId/estado  activa o desactiva una medida
 *
 * Leer: personal con sesión. Escribir: permiso "Productos".
 */
export const rutasModelos = Router();
rutasModelos.use(autenticar, soloPersonal);

const conId = validar(esquemaId, 'params');
const conReferencia = validar(esquemaIdReferencia, 'params');
const escritura = requierePermiso('Productos');

rutasModelos.get('/', validar(esquemaFiltros, 'query'), controlador.listar);
rutasModelos.get('/:id', conId, controlador.obtener);
rutasModelos.post('/', escritura, validar(esquemaNuevo), controlador.crear);
rutasModelos.put('/:id', escritura, conId, validar(esquemaEdicion), controlador.actualizar);
rutasModelos.patch('/:id/estado', escritura, conId, validar(esquemaEstado), controlador.cambiarEstado);
rutasModelos.post('/:id/referencias', escritura, conId, validar(esquemaReferencia), controlador.crearReferencia);
rutasModelos.put('/:id/referencias', escritura, conId, validar(esquemaReferenciasEnBloque), controlador.guardarReferencias);
rutasModelos.put(
  '/:id/referencias/:referenciaId',
  escritura,
  conReferencia,
  validar(esquemaEdicionReferencia),
  controlador.actualizarReferencia,
);
rutasModelos.patch(
  '/:id/referencias/:referenciaId/estado',
  escritura,
  conReferencia,
  validar(esquemaEstado),
  controlador.cambiarEstadoReferencia,
);
