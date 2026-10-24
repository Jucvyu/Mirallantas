import { Router } from 'express';
import * as abonos from '../controllers/abonos.controller.js';
import * as creditos from '../controllers/creditos.controller.js';
import * as solicitudes from '../controllers/solicitudesCredito.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import {
  esquemaAbonoFactura,
  esquemaFacturas,
  esquemaAbono,
  esquemaActivoCredito,
  esquemaCambioAbono,
  esquemaCredito,
  esquemaListadoAbonos,
  esquemaListadoCreditos,
  esquemaListadoSolicitudes,
  esquemaRevision,
  esquemaSolicitud,
} from '../validators/cartera.validator.js';

/**
 * Rutas de la cartera: créditos, abonos y solicitudes de crédito.
 */

// ---- Créditos (/api/creditos) ------------------------------------------------
//   GET    /                    listado (el portal solo ve los suyos)
//   GET    /:numero             detalle con sus abonos
//   POST   /                    abre un crédito sobre una cotización completada
//   PATCH  /:numero             activa o desactiva
//   POST   /:numero/abonos      registra un abono (asesor o cliente dueño)
export const rutasCreditos = Router();
rutasCreditos.use(autenticar, requierePermiso('Cartera'));

rutasCreditos.get('/', validar(esquemaListadoCreditos, 'query'), creditos.listar);
rutasCreditos.get('/:numero', creditos.obtener);
rutasCreditos.post('/', soloPersonal, validar(esquemaCredito), creditos.crear);
rutasCreditos.patch('/:numero', soloPersonal, validar(esquemaActivoCredito), creditos.cambiarActivo);
rutasCreditos.post('/:numero/abonos', validar(esquemaAbono), creditos.registrarAbono);

// ---- Abonos (/api/abonos) — validación del asesor ------------------------------
//   GET    /            listado
//   PATCH  /:numero     confirmar, rechazar o corregir uno pendiente
//   GET    /:numero/pdf comprobante en tirilla (solo confirmado)
export const rutasAbonos = Router();
rutasAbonos.use(autenticar, soloPersonal, requierePermiso('Abonos'));

rutasAbonos.get('/', validar(esquemaListadoAbonos, 'query'), abonos.listar);
// Facturas (ventas a crédito con saldo) y abono del asesor sobre una de ellas
rutasAbonos.get('/facturas', validar(esquemaFacturas, 'query'), abonos.facturas);
rutasAbonos.post('/', validar(esquemaAbonoFactura), abonos.registrarEnFactura);
rutasAbonos.patch('/:numero', validar(esquemaCambioAbono), abonos.actualizar);
rutasAbonos.get('/:numero/pdf', abonos.pdf);

// ---- Solicitudes de crédito (/api/solicitudes-credito) ---------------------------
//   GET    /            listado (el portal solo ve las suyas)
//   GET    /:numero     detalle: líneas de su cotización y la consignación
//   POST   /            nueva solicitud (cliente o asesor)
//   PATCH  /:numero     el asesor aprueba o rechaza
//   DELETE /:numero     elimina una pendiente
export const rutasSolicitudesCredito = Router();
rutasSolicitudesCredito.use(autenticar, requierePermiso('Cartera'));

rutasSolicitudesCredito.get('/', validar(esquemaListadoSolicitudes, 'query'), solicitudes.listar);
rutasSolicitudesCredito.get('/:numero', solicitudes.obtener);
rutasSolicitudesCredito.post('/', validar(esquemaSolicitud), solicitudes.crear);
rutasSolicitudesCredito.patch('/:numero', soloPersonal, validar(esquemaRevision), solicitudes.revisar);
rutasSolicitudesCredito.delete('/:numero', soloPersonal, solicitudes.eliminar);
