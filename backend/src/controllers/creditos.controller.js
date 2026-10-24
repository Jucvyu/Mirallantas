import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import { claveIdempotencia } from '../middleware/idempotencia.js';
import * as abonosModel from '../models/abonos.model.js';
import * as clientesModel from '../models/clientes.model.js';
import * as creditosModel from '../models/creditos.model.js';
import { exigirMedioDelCliente, pesos, exigirAbonoMinimo } from '../reglas.js';
import { enviarDato, enviarLista } from '../views/respuesta.view.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador de créditos y del registro de abonos.
 *
 * Regla central: un cliente solo puede tener un crédito abierto (con saldo
 * pendiente). La base de datos lo garantiza; aquí se revisa antes para dar
 * un mensaje claro.
 */

/** Lanza 422 con un mensaje claro si el cliente ya tiene un crédito abierto. */
export async function exigirSinCreditoAbierto(db, clienteId) {
  const abierto = await clientesModel.creditoAbierto(db, clienteId);
  if (abierto) {
    throw new HttpError(422, `El cliente ya tiene el crédito ${abierto} abierto: solo se permite uno a la vez.`);
  }
}

/** Crédito con sus abonos, respetando el alcance del portal. */
async function leerCompleto(req, numero) {
  const credito = await creditosModel.buscarPorNumero(numero, { clienteId: clienteDeSesion(req) });
  return { ...credito, abonos: await abonosModel.deCredito(credito.id) };
}

/** GET /creditos — el portal solo ve los suyos. */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await creditosModel.listar({ ...req.validado.query, clienteId: clienteDeSesion(req) });
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/** GET /creditos/:numero — con sus abonos. */
export async function obtener(req, res) {
  enviarDato(res, await leerCompleto(req, req.params.numero));
}

/** POST /creditos — financia una cotización completada. */
export async function crear(req, res) {
  const datos = req.validado.body;

  const numero = await enTransaccion(async (db) => {
    const cotizacion = await creditosModel.cotizacionParaFinanciar(db, datos.cotizacion);
    if (!cotizacion) throw new HttpError(422, `La cotización ${datos.cotizacion} no existe.`);
    if (cotizacion.estado !== 'Completada') throw new HttpError(422, 'Solo se financia una cotización completada.');

    const repetido = await creditosModel.creditoDeCotizacion(db, cotizacion.id);
    if (repetido) throw new HttpError(422, `La cotización ya tiene el crédito ${repetido}: admite uno solo.`);
    await exigirSinCreditoAbierto(db, cotizacion.cliente_id);
    await exigirActivo('cliente', cotizacion.cliente_id, db);

    return creditosModel.crear(db, {
      clienteId: cotizacion.cliente_id,
      ventaId: cotizacion.venta_id,
      cotizacionId: cotizacion.id,
      montoTotal: datos.montoTotal,
      plazoDias: datos.plazoDias,
    });
  });

  enviarDato(res, await leerCompleto(req, numero), 201);
}

/** PATCH /creditos/:numero — activar o desactivar. */
export async function cambiarActivo(req, res) {
  if (!(await creditosModel.cambiarActivo(req.params.numero, req.validado.body.activo))) {
    throw new HttpError(404, 'El crédito no existe.');
  }
  enviarDato(res, await leerCompleto(req, req.params.numero));
}

/** POST /creditos/:numero/abonos — lo registra un asesor o el cliente dueño del crédito. */
export async function registrarAbono(req, res) {
  const datos = req.validado.body;
  // El pantallazo solo aplica a transferencias: efectivo y tarjeta dejan su propio recibo
  // Desde el portal solo se abona en efectivo o por transferencia
  if (clienteDeSesion(req)) exigirMedioDelCliente(datos.medioPago);
  if (datos.medioPago === 'Transferencia' && !datos.comprobante) {
    throw new HttpError(422, 'Adjunta el comprobante de la transferencia.');
  }

  const clave = claveIdempotencia(req);
  let repetido = false;

  const numero = await enTransaccion(async (db) => {
    // El alcance del portal hace que un cliente solo abone a sus créditos
    const credito = await creditosModel.buscarPorNumero(
      req.params.numero,
      { clienteId: clienteDeSesion(req), bloquear: 'cr' },
      db,
    );
    // El crédito quedó bloqueado (FOR UPDATE): si llega el mismo abono dos
    // veces a la vez, el segundo espera y aquí encuentra el primero
    const existente = clave && (await abonosModel.numeroPorClave(db, credito.id, clave));
    if (existente) {
      repetido = true;
      return existente;
    }
    // Un crédito desactivado (p. ej. en revisión o castigado) no recibe abonos
    if (!credito.iniciado) throw new HttpError(422, 'El crédito empieza cuando se pague la cuota inicial: todavía no recibe abonos.');
    if (!credito.activo) throw new HttpError(422, 'El crédito está inactivo: no recibe abonos por ahora.');
    if (credito.saldoPendiente <= 0) throw new HttpError(422, 'El crédito ya está pagado.');
    if (datos.monto > credito.saldoPendiente) {
      throw new HttpError(422, `El abono no puede superar el saldo pendiente (${pesos(credito.saldoPendiente)}).`);
    }
    exigirAbonoMinimo(datos.monto, credito.saldoPendiente);
    return abonosModel.crear(db, {
      creditoId: credito.id,
      monto: datos.monto,
      medioPago: datos.medioPago,
      comprobante: datos.medioPago === 'Transferencia' ? datos.comprobante : null,
      claveIdempotencia: clave,
    });
  });

  enviarDato(res, await abonosModel.buscarPorNumero(numero), repetido ? 200 : 201);
}
