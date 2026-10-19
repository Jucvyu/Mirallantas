import { Router } from 'express';
import * as controlador from '../controllers/solicitudesServicio.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import {
  esquemaCambio,
  esquemaListado,
  esquemaNueva,
  esquemaRevisionPago,
} from '../validators/solicitudesServicio.validator.js';

/**
 * Rutas de solicitudes de servicio de reencauche (/api/solicitudes-servicio),
 * solo para el personal interno.
 *
 *   GET    /            listado
 *   GET    /:numero     una solicitud
 *   POST   /:numero/pago  aprobar o rechazar el pago del servicio
 *   POST   /            nueva solicitud
 *   PATCH  /:numero     asignar reencauchadora, calificar carcasa, cambiar estado
 *   DELETE /:numero     elimina una pendiente que no venga de una cotización
 */
export const rutasSolicitudesServicio = Router();
rutasSolicitudesServicio.use(autenticar, soloPersonal, requierePermiso('Solicitudes de servicio'));

rutasSolicitudesServicio.get('/', validar(esquemaListado, 'query'), controlador.listar);
rutasSolicitudesServicio.get('/:numero', controlador.obtener);
rutasSolicitudesServicio.post('/', validar(esquemaNueva), controlador.crear);
rutasSolicitudesServicio.patch('/:numero', validar(esquemaCambio), controlador.actualizar);
rutasSolicitudesServicio.post('/:numero/pago', validar(esquemaRevisionPago), controlador.revisarPago);
rutasSolicitudesServicio.delete('/:numero', controlador.eliminar);
