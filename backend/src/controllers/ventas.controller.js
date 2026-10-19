import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import { aPares } from '../models/listado.model.js';
import * as ventasModel from '../models/ventas.model.js';
import { CUOTA_INICIAL_CREDITO, pesos, validarTransicion } from '../reglas.js';
import { enviarDocumento, enviarDocumentos } from '../views/documentos.view.js';
import { exigirActivo } from './estados.js';
import { devolverLineas } from './inventario.js';

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

/** POST /ventas — venta directa. */
export async function crear(req, res) {
  const v = req.validado.body;
  const esCredito = v.metodoPago === 'Crédito';
  const cuotaInicial = esCredito ? (v.cuotaInicial ?? 0) : 0;

  // A crédito, la primera cuota debe cubrir al menos la mitad del total
  if (esCredito) {
    const minimo = Math.round(v.total * CUOTA_INICIAL_CREDITO);
    if (cuotaInicial < minimo) {
      throw new HttpError(422, `La primera cuota debe ser de al menos ${pesos(minimo)} (50 % del total).`);
    }
  }
  if (cuotaInicial > v.total) throw new HttpError(422, 'La cuota inicial no puede superar el total.');
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
      // Venta anulada: las llantas vendidas vuelven al inventario
      if (cambios.estado === 'Anulada') await devolverLineas(db, await ventasModel.lineas(actual.id, db));
    }
    if (cambios.estadoEntrega && cambios.estadoEntrega !== actual.estadoEntrega) {
      validarTransicion('entrega', actual.estadoEntrega, cambios.estadoEntrega);
    }
    await ventasModel.actualizar(db, actual.id, aPares(cambios, ventasModel.COLUMNAS));
  });

  enviarDocumento(res, await leerCompleta(req, req.params.numero));
}
