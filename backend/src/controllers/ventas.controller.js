import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import * as clientesModel from '../models/clientes.model.js';
import * as empresaModel from '../models/empresa.model.js';
import { aPares } from '../models/listado.model.js';
import * as ventasModel from '../models/ventas.model.js';
import { CUOTA_INICIAL_PORCENTAJE, cuotaMinimaDe, pesos, validarTransicion } from '../reglas.js';
import { enviarDocumento, enviarDocumentos } from '../views/documentos.view.js';
import { enviarPdfVenta } from '../views/pdf.view.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador de ventas.
 *
 * Las ventas con detalle nacen solas al completar una cotización (ver
 * cotizaciones.controller.js). Aquí se registran las ventas directas y se
 * cambian estados. Una venta no se borra: se anula.
 */

/** Venta completa (cabecera + líneas), respetando el alcance del portal. */
async function leerCompleta(req, numero) {
  const venta = await ventasModel.buscarPorNumero(numero, { clienteId: clienteDeSesion(req) });
  return { ...venta, detalle: await ventasModel.lineas(venta.id) };
}

/** GET /ventas — el portal solo ve las suyas. */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const clienteId = clienteDeSesion(req);
  const resultado = await ventasModel.listar({ ...req.validado.query, clienteId });
  enviarDocumentos(res, { ...resultado, pagina, porPagina }, Boolean(clienteId));
}

/** GET /ventas/:numero */
export async function obtener(req, res) {
  enviarDocumento(res, await leerCompleta(req, req.params.numero), Boolean(clienteDeSesion(req)));
}

/**
 * GET /ventas/:numero/pdf (personal) y GET /portal/ventas/:numero/pdf
 * (cliente, solo las suyas) — comprobante de la venta en PDF.
 */
export async function pdf(req, res) {
  const venta = await ventasModel.buscarPorNumero(req.params.numero, { clienteId: clienteDeSesion(req) });
  const [lineas, cliente, empresa] = await Promise.all([
    ventasModel.lineas(venta.id),
    clientesModel.paraDocumento(venta.clienteId),
    empresaModel.obtener(),
  ]);
  enviarPdfVenta(res, { empresa, venta, cliente, lineas });
}

/** POST /ventas — venta directa. */
export async function crear(req, res) {
  const v = req.validado.body;
  const esCredito = v.metodoPago === 'Crédito';
  const cuotaInicial = esCredito ? (v.cuotaInicial ?? 0) : 0;

  // A crédito, la cuota inicial cubre al menos el 30 % del total (el resto
  // queda financiado); de contado se paga el 100 %
  if (esCredito) {
    const minimo = cuotaMinimaDe(v.total, v.metodoPago);
    if (cuotaInicial < minimo) {
      throw new HttpError(
        422,
        `La cuota inicial debe ser de al menos ${pesos(minimo)} (${CUOTA_INICIAL_PORCENTAJE} % del total).`,
      );
    }
    if (cuotaInicial >= v.total) throw new HttpError(422, 'Si se paga todo de una vez, registra la venta de contado.');
  }
  await exigirActivo('cliente', v.clienteId);
  await exigirActivo('proveedor', v.proveedorId);

  const numero = await ventasModel.crearDirecta({ ...v, cuotaInicial, interes: esCredito ? (v.interes ?? 0) : 0 });
  enviarDocumento(res, await leerCompleta(req, numero), false, 201);
}

/** PATCH /ventas/:numero — estado (p. ej. anular), entrega o datos de apoyo. */
export async function actualizar(req, res) {
  const cambios = req.validado.body;

  await enTransaccion(async (db) => {
    const actual = await ventasModel.buscarPorNumero(req.params.numero, { bloquear: 'v' }, db);
    if (actual.estado === 'Anulada') throw new HttpError(422, 'La venta está anulada: ya no se modifica.');

    if (cambios.estado && cambios.estado !== actual.estado) {
      validarTransicion('venta', actual.estado, cambios.estado);
    }
    if (cambios.estadoEntrega && cambios.estadoEntrega !== actual.estadoEntrega) {
      validarTransicion('entrega', actual.estadoEntrega, cambios.estadoEntrega);
    }
    await ventasModel.actualizar(db, actual.id, aPares(cambios, ventasModel.COLUMNAS));
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero));
}

/** GET /portal/ventas/:numero/pdf — solo el cliente dueño de la venta. */
export async function pdfDesdePortal(req, res) {
  if (!clienteDeSesion(req)) throw new HttpError(403, 'Esta acción es para los clientes del portal.');
  await pdf(req, res);
}
