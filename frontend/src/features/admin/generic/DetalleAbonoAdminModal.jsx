import { useState } from 'react';
import { Check, ImageOff, Wallet, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useEnvio } from '../../../hooks/useEnvio';
import { abonosService } from '../../../services';

/**
 * Detalle de un abono para el asesor (módulo Abonos).
 *
 * Muestra el pago y la consignación que adjuntó el cliente, completa y sin
 * recortar, porque es la prueba que se revisa. Si el abono sigue
 * pendiente, desde aquí mismo se confirma o se rechaza:
 *
 *   Confirmar → baja el saldo del crédito y sube el saldo usable del cliente.
 *   Rechazar  → el abono queda registrado sin cambiar el saldo; el motivo
 *               le llega al cliente, que vuelve a subir el abono.
 */
export default function DetalleAbonoAdminModal({ abono, onResuelto, onClose }) {
  const { enviando, errorEnvio, enviar } = useEnvio();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const pendiente = abono.estado === 'Pendiente';

  const resolver = (estado, cerrar) =>
    enviar(async () => {
      await abonosService.cambiarEstado(abono, estado, motivo.trim());
      await onResuelto?.();
    }, cerrar);

  const pie = (cerrar) =>
    pendiente && rechazando ? (
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
      <button
        type="button"
        onClick={cerrar}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
      >
        Cerrar
      </button>
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

        {/* ---- Monto y estado ---- */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto abonado</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{abono.monto}</p>
          </div>
          <Badge>{abono.estado}</Badge>
        </section>

        {/* ---- Datos del pago ---- */}
        <section className="grid grid-cols-2 gap-3">
          {[
            { label: 'Crédito', valor: abono.credito },
            { label: 'Cliente', valor: abono.cliente },
            { label: 'Fecha', valor: abono.fecha },
            { label: 'Medio de pago', valor: abono.metodoPago },
          ].map(({ label, valor }) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{valor || '—'}</p>
            </div>
          ))}
        </section>

        {abono.motivoRechazo && (
          <p className="rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
            Rechazado: {abono.motivoRechazo}
          </p>
        )}

        {/* ---- Consignación ---- */}
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Consignación
          </p>
          {abono.comprobante ? (
            <a href={abono.comprobante} target="_blank" rel="noreferrer" title="Abrir la consignación completa">
              <img
                src={abono.comprobante}
                alt={`Consignación del abono ${abono.id}`}
                className="max-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-white/10 dark:bg-white/5"
              />
            </a>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-white/10">
              <ImageOff size={22} strokeWidth={1.5} />
              {abono.metodoPago === 'Transferencia'
                ? 'Sin consignación adjunta.'
                : `Pago en ${String(abono.metodoPago ?? '').toLowerCase()}: no requiere consignación.`}
            </div>
          )}
        </section>
        {/* ---- Motivo del rechazo ---- */}
        {pendiente && rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo del rechazo</span>
            <textarea
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
