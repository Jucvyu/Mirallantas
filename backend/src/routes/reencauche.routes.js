import { Router } from 'express';
import * as bandas from '../controllers/bandas.controller.js';
import * as controlador from '../controllers/reencauches.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaEstado } from '../validators/catalogos.validator.js';
import { esquemaId, esquemaListado } from '../validators/comunes.validator.js';
import {
  esquemaAgenda,
  esquemaBanda,
  esquemaCambioBanda,
  esquemaCancelacion,
  esquemaEntrega,
  esquemaEnvio,
  esquemaListadoOrdenes,
  esquemaListadoReencauches,
  esquemaRechazoPlanta,
  esquemaRespuesta,
  esquemaRevision,
  esquemaSolicitudPersonal,
} from '../validators/reencauche.validator.js';

const conId = validar(esquemaId, 'params');

/**
 * Catálogo de bandas (/api/bandas), solo para el personal con el módulo
 * Reencauche. El portal ve las bandas activas en /api/portal/bandas.
 *
 *   GET    /             listado (?q=, ?activo=)
 *   GET    /:id          una banda
 *   POST   /             nueva banda
 *   PUT    /:id          cambia datos y medidas compatibles
 *   PATCH  /:id/estado   activa o desactiva
 *   DELETE /:id          elimina (409 si un reencauche ya la usa)
 */
export const rutasBandas = Router();
rutasBandas.use(autenticar, soloPersonal, requierePermiso('Reencauche'));

rutasBandas.get('/', validar(esquemaListado, 'query'), bandas.listar);
rutasBandas.get('/:id', conId, bandas.obtener);
rutasBandas.post('/', validar(esquemaBanda), bandas.crear);
rutasBandas.put('/:id', conId, validar(esquemaCambioBanda), bandas.actualizar);
rutasBandas.patch('/:id/estado', conId, validar(esquemaEstado), bandas.cambiarEstado);
rutasBandas.delete('/:id', conId, bandas.eliminar);

/**
 * Reencauches (/api/reencauches), solo para el personal.
 *
 *   GET  /                          solicitudes (?q=, ?estado=)
 *   GET  /ordenes                   llantas aceptadas, una orden por llanta (?estado=)
 *   POST /ordenes/:id/envio         enviar a la reencauchadora
 *   POST /ordenes/:id/lista         la planta la devolvió reencauchada
 *   POST /ordenes/:id/rechazo       la planta la rechazó (no se cobra)
 *   POST /ordenes/:id/entrega       entregar y cobrar
 *   GET  /:numero                   una solicitud con sus llantas
 *   POST /                          registrar la solicitud de un cliente
 *   POST /:numero/agenda            agendar (o cambiar) la revisión
 *   POST /:numero/revision          lo que se encontró en cada llanta
 *   POST /:numero/respuesta         el cliente acepta o no, en el local
 *   POST /:numero/cancelar          cancelar antes de la revisión
 */
export const rutasReencauches = Router();
rutasReencauches.use(autenticar, soloPersonal, requierePermiso('Reencauche'));

rutasReencauches.get('/', validar(esquemaListadoReencauches, 'query'), controlador.listar);
rutasReencauches.get('/ordenes', validar(esquemaListadoOrdenes, 'query'), controlador.listarOrdenes);
rutasReencauches.post('/ordenes/:id/envio', conId, validar(esquemaEnvio), controlador.enviarOrden);
rutasReencauches.post('/ordenes/:id/lista', conId, controlador.marcarLista);
rutasReencauches.post('/ordenes/:id/rechazo', conId, validar(esquemaRechazoPlanta), controlador.rechazarEnPlanta);
rutasReencauches.post('/ordenes/:id/entrega', conId, validar(esquemaEntrega), controlador.entregarOrden);
rutasReencauches.get('/:numero', controlador.obtener);
rutasReencauches.post('/', validar(esquemaSolicitudPersonal), controlador.crear);
rutasReencauches.post('/:numero/agenda', validar(esquemaAgenda), controlador.agendar);
rutasReencauches.post('/:numero/revision', validar(esquemaRevision), controlador.registrarRevision);
rutasReencauches.post('/:numero/respuesta', validar(esquemaRespuesta), controlador.responderEnLocal);
rutasReencauches.post('/:numero/cancelar', validar(esquemaCancelacion), controlador.cancelar);
