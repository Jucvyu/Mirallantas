import { Router } from 'express';
import { z } from 'zod';
import * as cotizaciones from '../controllers/cotizaciones.controller.js';
import * as controlador from '../controllers/portal.controller.js';
import { autenticar } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import * as ventas from '../controllers/ventas.controller.js';
import { esquemaAceptacion, esquemaCancelacionCliente, esquemaPagoCliente } from '../validators/cotizaciones.validator.js';
import { esquemaPagoServicio } from '../validators/solicitudesServicio.validator.js';

/**
 * Rutas del portal del cliente (/api/portal).
 *
 *   GET  /resumen                  cotizaciones (con sus líneas), créditos, abonos,
 *                                  solicitudes de crédito e indicadores del inicio
 *   POST /servicios/:numero/pago   pagar un servicio de reencauche (con comprobante)
 *   POST /cotizaciones/:numero/aceptar  aceptar la cotización formal (contado o crédito)
 *   POST /cotizaciones/:numero/cancelar cancelarla (pendiente y sin aceptar; queda Rechazada)
 *   POST /cotizaciones/:numero/pago  volver a subir el pago de contado rechazado
 *   GET  /ventas/:numero/pdf       comprobante de una venta propia en PDF
 *   GET  /notificaciones           avisos del asesor y cuántos faltan por leer
 *   POST /notificaciones/leidas    marcarlos como leídos
 *   GET  /notificaciones/por-modulo  avisos sin leer por sección (burbujas del menú)
 *   POST /notificaciones/vista     el cliente entró a una sección ({ ruta })
 */
export const rutasPortal = Router();
rutasPortal.use(autenticar);

rutasPortal.get('/resumen', controlador.resumen);
rutasPortal.post('/servicios/:numero/pago', validar(esquemaPagoServicio), controlador.pagarServicio);
rutasPortal.post('/cotizaciones/:numero/aceptar', validar(esquemaAceptacion), cotizaciones.aceptarDesdePortal);
rutasPortal.post('/cotizaciones/:numero/cancelar', validar(esquemaCancelacionCliente), cotizaciones.cancelarDesdePortal);
rutasPortal.get('/ventas/:numero/pdf', ventas.pdfDesdePortal);
rutasPortal.post('/cotizaciones/:numero/pago', validar(esquemaPagoCliente), cotizaciones.volverAPagar);
rutasPortal.post('/cotizaciones/:numero/cuota', validar(esquemaPagoCliente), cotizaciones.pagarCuota);
rutasPortal.get('/notificaciones', controlador.listarNotificaciones);
rutasPortal.post('/notificaciones/leidas', controlador.marcarLeidas);
rutasPortal.get('/notificaciones/por-modulo', controlador.notificacionesPorModulo);
rutasPortal.post(
  '/notificaciones/vista',
  validar(z.object({ ruta: z.string().trim().regex(/^\/portal\/[a-z-]{1,40}$/, 'Ruta no válida.') })),
  controlador.marcarSeccionVista,
);
