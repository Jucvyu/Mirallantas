import { Router } from 'express';
import * as controlador from '../controllers/cotizaciones.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import {
  esquemaAceptacion,
  esquemaCambio,
  esquemaEmision,
  esquemaListado,
  esquemaNueva,
  esquemaPagoCliente,
  esquemaRevisionPago,
} from '../validators/cotizaciones.validator.js';

/**
 * Rutas de cotizaciones-pedido (/api/cotizaciones).
 *
 *   GET    /                  listado (el portal solo ve las suyas)
 *   GET    /:numero           detalle con sus líneas
 *   GET    /:numero/pdf       la cotización formal en PDF
 *   POST   /                  solicitud de cotización (asesor o cliente del portal)
 *   POST   /:numero/emitir    el asesor confirma los precios y emite la cotización formal
 *   POST   /:numero/aceptar   el asesor registra la aceptación (contado o crédito) en el local
 *   PATCH  /:numero           el asesor cambia el estado o la entrega
 *   DELETE /:numero           el asesor elimina una cotización pendiente
 */
export const rutasCotizaciones = Router();
rutasCotizaciones.use(autenticar, requierePermiso('Pedidos-Cotización'));

rutasCotizaciones.get('/', validar(esquemaListado, 'query'), controlador.listar);
rutasCotizaciones.get('/:numero', controlador.obtener);
rutasCotizaciones.get('/:numero/pdf', controlador.pdf);
rutasCotizaciones.post('/', validar(esquemaNueva), controlador.crear);
rutasCotizaciones.post('/:numero/emitir', soloPersonal, validar(esquemaEmision), controlador.emitir);
rutasCotizaciones.post('/:numero/aceptar', soloPersonal, validar(esquemaAceptacion), controlador.aceptar);
rutasCotizaciones.patch('/:numero', soloPersonal, validar(esquemaCambio), controlador.actualizar);
// Aprobar o rechazar la consignación del pago de contado
rutasCotizaciones.post('/:numero/pago', soloPersonal, validar(esquemaRevisionPago), controlador.revisarPago);
// La cuota inicial del crédito aprobado, cuando el cliente la paga en el local
rutasCotizaciones.post('/:numero/cuota', soloPersonal, validar(esquemaPagoCliente), controlador.pagarCuota);
rutasCotizaciones.delete('/:numero', soloPersonal, controlador.eliminar);
