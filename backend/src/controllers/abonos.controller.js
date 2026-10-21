import { enTransaccion } from '../db.js';
import { claveIdempotencia } from '../middleware/idempotencia.js';
import { HttpError } from '../errores.js';
import * as abonosModel from '../models/abonos.model.js';
import * as creditosModel from '../models/creditos.model.js';
import * as notificaciones from '../models/notificaciones.model.js';
import { pesos, validarTransicion } from '../reglas.js';
import { enviarDato, enviarLista } from '../views/respuesta.view.js';

/**
 * Controlador de abonos (validación del asesor).
 *
 * Confirmar un abono significa que el dinero llegó: en ese momento, y en
 * la misma transacción, se descuenta del saldo del crédito. Rechazarlo
 * guarda el motivo y le pide al cliente que vuelva a subir el abono. En
 * los dos casos el cliente recibe una notificación.
 */

/**
 * GET /abonos/facturas — facturas (ventas a crédito) que admiten abonos,
 * para el buscador del formulario. ?clienteId= limita a un cliente.
 */
export async function facturas(req, res) {
  enviarDato(res, await abonosModel.facturasConSaldo(req.validado.query));
}

/**
 * POST /abonos — el asesor registra un pago sobre una factura.
 *
 * En una sola transacción, con la factura y su crédito bloqueados: valida
 * la factura, que el monto sea mayor que cero y que no supere el saldo,
 * guarda el abono como "Confirmado" (el dinero ya lo recibió el asesor) y
 * descuenta el saldo. Si algo falla no queda ni el abono ni el descuento.
 * La clave de idempotencia evita registrarlo dos veces por un doble envío.
 */
export async function registrarEnFactura(req, res) {
  const datos = req.validado.body;
  if (datos.medioPago === 'Transferencia' && !datos.comprobante) {
    throw new HttpError(422, 'Adjunta el comprobante de la transferencia.');
  }
  const clave = claveIdempotencia(req);
  let repetido = false;

  const numero = await enTransaccion(async (db) => {
    const factura = await abonosModel.facturaBloqueada(db, datos.factura);
    if (!factura) throw new HttpError(422, 'La factura no existe o no es una venta a crédito.');
    const existente = clave && (await abonosModel.numeroPorClave(db, factura.credito_id, clave));
    if (existente) {
      repetido = true;
      return existente;
    }
    if (factura.estado === 'Anulada') throw new HttpError(422, 'La factura está anulada: no recibe abonos.');
    if (!factura.activo) throw new HttpError(422, 'El crédito de la factura está inactivo: no recibe abonos por ahora.');
    if (factura.saldo_pendiente <= 0) throw new HttpError(422, 'La factura ya está pagada.');
    if (datos.monto > factura.saldo_pendiente) {
      throw new HttpError(422, `El abono no puede superar el saldo pendiente (${pesos(factura.saldo_pendiente)}).`);
    }
    const nuevo = await abonosModel.crear(db, {
      creditoId: factura.credito_id,
      monto: datos.monto,
      medioPago: datos.medioPago,
      comprobante: datos.medioPago === 'Transferencia' ? datos.comprobante : null,
      claveIdempotencia: clave,
      estado: 'Confirmado',
    });
    await creditosModel.descontarSaldo(db, factura.credito_id, datos.monto);
    await notificaciones.crear(
      {
        clienteId: factura.cliente_id,
        titulo: `Abono registrado · ${factura.numero}`,
        mensaje: `Registramos tu pago de ${pesos(datos.monto)}. Saldo pendiente: ${pesos(factura.saldo_pendiente - datos.monto)}.`,
        enlace: '/portal/cartera',
        tipo: 'exito',
      },
      db,
    );
    return nuevo;
  });

  enviarDato(res, await abonosModel.buscarPorNumero(numero), repetido ? 200 : 201);
}

/** GET /abonos */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await abonosModel.listar(req.validado.query);
  enviarLista(res, { ...resultado, pagina, porPagina });
}

/** PATCH /abonos/:numero — confirmar, rechazar o corregir uno pendiente. */
export async function actualizar(req, res) {
  const cambios = req.validado.body;

  await enTransaccion(async (db) => {
    const abono = await abonosModel.bloquearConCredito(db, req.params.numero);
    if (!abono) throw new HttpError(404, 'El abono no existe.');

    // ---- Corregir monto o medio de pago (solo si sigue pendiente)
    if ((cambios.monto !== undefined || cambios.medioPago) && abono.estado !== 'Pendiente') {
      throw new HttpError(422, 'Solo se corrige un abono pendiente.');
    }
    if (cambios.monto !== undefined) {
      await abonosModel.actualizar(db, abono.id, [['monto', cambios.monto]]);
      abono.monto = cambios.monto;
    }
    if (cambios.medioPago) await abonosModel.actualizar(db, abono.id, [['medio_pago', cambios.medioPago]]);

    // ---- Cambio de estado
    if (cambios.estado && cambios.estado !== abono.estado) {
      validarTransicion('abono', abono.estado, cambios.estado);
      // Confirmar = el dinero llegó: se descuenta del saldo del crédito
      if (cambios.estado === 'Confirmado') {
        if (abono.monto > abono.saldo_pendiente) {
          throw new HttpError(
            422,
            `El abono (${pesos(abono.monto)}) supera el saldo pendiente (${pesos(abono.saldo_pendiente)}).`,
          );
        }
        await creditosModel.descontarSaldo(db, abono.credito_id, abono.monto);
      }
      const motivo = cambios.estado === 'Rechazado' ? cambios.motivo || 'El comprobante no se pudo validar.' : null;
      await abonosModel.actualizar(db, abono.id, [
        ['estado', cambios.estado],
        ['motivo_rechazo', motivo],
      ]);
      await notificaciones.crear(
        cambios.estado === 'Confirmado'
          ? {
              clienteId: abono.cliente_id,
              titulo: `Abono confirmado · ${abono.numero}`,
              mensaje: `Recibimos tu abono de ${pesos(abono.monto)}. Tu saldo usable ya se actualizó.`,
              enlace: '/portal/cartera',
              tipo: 'exito',
            }
          : {
              clienteId: abono.cliente_id,
              titulo: `Abono rechazado · ${abono.numero}`,
              mensaje: `Motivo: ${motivo} Vuelve a subir el abono desde "Mi cartera".`,
              enlace: '/portal/cartera',
              tipo: 'alerta',
            },
        db,
      );
    }
  });

  enviarDato(res, await abonosModel.buscarPorNumero(req.params.numero));
}
