import { Router } from 'express';
import * as cotizaciones from '../controllers/cotizaciones.controller.js';
import * as controlador from '../controllers/portal.controller.js';
import { autenticar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaPagoCliente } from '../validators/cotizaciones.validator.js';
import { esquemaPagoServicio } from '../validators/solicitudesServicio.validator.js';

/**
 * Rutas del portal del cliente (/api/portal).
 *
 *   GET  /resumen                  cotizaciones (con sus líneas), créditos, abonos,
 *                                  solicitudes de crédito e indicadores del inicio
 *   POST /servicios/:numero/pago   pagar un servicio de reencauche (con comprobante)
 *   POST /cotizaciones/:numero/pago  volver a subir el pago de contado rechazado
 *   GET  /notificaciones           avisos del asesor y cuántos faltan por leer
 *   POST /notificaciones/leidas    marcarlos como leídos
 */
export const rutasPortal = Router();
rutasPortal.use(autenticar);

rutasPortal.get('/resumen', controlador.resumen);
rutasPortal.post('/servicios/:numero/pago', validar(esquemaPagoServicio), controlador.pagarServicio);
rutasPortal.post('/cotizaciones/:numero/pago', validar(esquemaPagoCliente), cotizaciones.volverAPagar);
rutasPortal.get('/notificaciones', controlador.listarNotificaciones);
rutasPortal.post('/notificaciones/leidas', controlador.marcarLeidas);
