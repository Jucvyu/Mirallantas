import { enTransaccion } from '../db.js';
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
