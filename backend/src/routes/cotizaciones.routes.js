import { Router } from 'express';
import * as controlador from '../controllers/cotizaciones.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaCambio, esquemaListado, esquemaNueva, esquemaRevisionPago } from '../validators/cotizaciones.validator.js';

/**
 * Rutas de cotizaciones-pedido (/api/cotizaciones).
 *
 *   GET    /             listado (el portal solo ve las suyas)
 *   GET    /:numero      detalle con sus líneas
 *   POST   /             crea una cotización (asesor o cliente del portal)
 *   PATCH  /:numero      el asesor confirma el valor, cambia el estado o la entrega
 *   DELETE /:numero      el asesor elimina una cotización pendiente
 */
export const rutasCotizaciones = Router();
rutasCotizaciones.use(autenticar, requierePermiso('Pedidos-Cotización'));

rutasCotizaciones.get('/', validar(esquemaListado, 'query'), controlador.listar);
rutasCotizaciones.get('/:numero', controlador.obtener);
rutasCotizaciones.post('/', validar(esquemaNueva), controlador.crear);
rutasCotizaciones.patch('/:numero', soloPersonal, validar(esquemaCambio), controlador.actualizar);
// Aprobar o rechazar la consignación del pago de contado
rutasCotizaciones.post('/:numero/pago', soloPersonal, validar(esquemaRevisionPago), controlador.revisarPago);
rutasCotizaciones.delete('/:numero', soloPersonal, controlador.eliminar);
