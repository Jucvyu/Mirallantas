import { useState } from 'react';
import { Check, ReceiptText, Wallet, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import { DetalleAviso, DetalleDatos, DetalleImagen, DetalleResumen, DetalleSeccion } from '../../../components/base/Detalle';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useEnvio } from '../../../hooks/useEnvio';
import { abonosService } from '../../../services';
import { MAX_TEXTO } from '../../../utils/validaciones';
import { usePrivilegio } from '../../../hooks/usePrivilegio';

/**
 * Detalle de un abono para el asesor (módulo Abonos).
 *
 * Muestra el pago y la consignación que adjuntó el cliente, completa y sin
 * recortar, porque es la prueba que se revisa. Si el abono sigue
 * pendiente, desde aquí mismo se confirma o se rechaza:
 *
 *   Confirmar → baja el saldo del crédito, sube el saldo usable del cliente
 *               y el monto cuenta como venta.
 *   Rechazar  → el abono queda registrado sin cambiar el saldo; el motivo
 *               le llega al cliente, que vuelve a subir el abono.
 */
export default function DetalleAbonoAdminModal({ abono, onResuelto, onClose }) {
  const { enviando, errorEnvio, enviar } = useEnvio();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Confirmar o rechazar solo con el privilegio del rol (nivel 3)
  const puede = usePrivilegio();
  const pendiente = abono.estado === 'Pendiente' && puede('confirmarAbono');
  // Confirmado por error: también se rechaza desde aquí (el dinero vuelve al saldo y sale de la venta)
  const puedeRevertir = abono.estado === 'Confirmado' && puede('confirmarAbono');

  const resolver = (estado, cerrar) =>
    enviar(async () => {
      await abonosService.cambiarEstado(abono, estado, motivo.trim());
      await onResuelto?.();
    }, cerrar);

  const pie = (cerrar) =>
    (pendiente || puedeRevertir) && rechazando ? (
      <>
        <button
          type="button"
          onClick={() => setRechazando(false)}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={() => resolver('Rechazado', cerrar)}
          disabled={enviando || !motivo.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
        >
          <X size={15} /> Confirmar rechazo
        </button>
      </>
    ) : pendiente ? (
      <>
        <button
          type="button"
          onClick={() => setRechazando(true)}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          <X size={15} /> Rechazar
        </button>
        <button
          type="button"
          onClick={() => resolver('Confirmado', cerrar)}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Check size={15} /> {enviando ? 'Guardando…' : 'Confirmar abono'}
        </button>
      </>
    ) : (
      <>
        {puedeRevertir && (
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <X size={15} /> Rechazar (confirmado por error)
          </button>
        )}
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          Cerrar
        </button>
      </>
    );

  return (
    <Modal
      title="Detalle del abono"
      subtitle={`${abono.id} · ${abono.cliente ?? ''}`}
      icon={<Wallet size={17} />}
      size="md"
      onClose={onClose}
      footer={pie}
    >
      <div className="space-y-5">
        <AvisoError mensaje={errorEnvio} />

        <DetalleResumen etiqueta="Monto abonado" valor={abono.monto} estado={abono.estado} />

        <DetalleDatos
          datos={[
            { etiqueta: 'Crédito', valor: abono.credito },
            { etiqueta: 'Factura', valor: abono.factura },
            { etiqueta: 'Cliente', valor: abono.cliente },
            { etiqueta: 'Fecha', valor: abono.fecha },
            { etiqueta: 'Método de pago', valor: abono.metodoPago },
          ]}
        />

        {abono.motivoRechazo && <DetalleAviso tono="peligro">Rechazado: {abono.motivoRechazo}</DetalleAviso>}

        <DetalleSeccion titulo="Consignación" icono={<ReceiptText size={15} />}>
          <DetalleImagen
            src={abono.comprobante}
            alt={`Consignación del abono ${abono.id}`}
            vacio={
              abono.metodoPago === 'Transferencia'
                ? 'Sin consignación adjunta.'
                : `Pago en ${String(abono.metodoPago ?? '').toLowerCase()}: no requiere consignación.`
            }
          />
        </DetalleSeccion>
        {/* ---- Motivo del rechazo ---- */}
        {(pendiente || puedeRevertir) && rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo del rechazo</span>
            <textarea
              maxLength={MAX_TEXTO}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="El cliente lo verá y volverá a subir el abono."
              className={`${INPUT} ${BORDER_OK} mt-1.5 resize-none`}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
