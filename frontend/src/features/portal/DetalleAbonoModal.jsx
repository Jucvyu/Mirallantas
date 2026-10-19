import { ImageOff, Receipt } from 'lucide-react';
import Badge from '../../components/base/Badge';
import Modal from '../../components/base/Modal';

/**
 * Detalle de un abono del cliente.
 *
 * Se abre al pulsar el abono en la cartera y responde a lo que el cliente
 * quiere confirmar de un pago que ya hizo: cuánto abonó, en qué estado va
 * la validación y qué consignación quedó adjunta. El pantallazo se muestra
 * completo, no recortado, porque es la prueba del pago.
 */
export default function DetalleAbonoModal({ abono, onClose }) {
  return (
    <Modal
      title="Detalle del abono"
      subtitle={`${abono.id} · ${abono.credito}`}
      icon={<Receipt size={17} />}
      size="md"
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          Cerrar
        </button>
      )}
    >
      <div className="space-y-5">
        {/* ---- Monto y estado, lo primero que se busca ---- */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Monto abonado
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{abono.monto}</p>
          </div>
          <Badge>{abono.estado}</Badge>
        </section>

        {/* ---- Rechazado: por qué, y qué hacer ---- */}
        {abono.estado === 'Rechazado' && (
          <p className="rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
            Motivo: {abono.motivoRechazo || 'el comprobante no se pudo validar.'} Vuelve a subir el abono desde la
            tarjeta del crédito.
          </p>
        )}

        <dl className="space-y-3 text-sm">
          {[
            ['Crédito', abono.credito],
            ['Fecha del pago', abono.fecha],
            ['Método de pago', abono.metodoPago],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">{etiqueta}</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">{valor || '—'}</dd>
            </div>
          ))}
        </dl>

        {/* ---- Comprobante ---- */}
        <figure>
          <figcaption className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Comprobante de pago
          </figcaption>
          {abono.comprobante ? (
            <img
              src={abono.comprobante}
              alt={`Comprobante del abono ${abono.id}`}
              className="max-h-72 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-white/10 dark:bg-white/5"
            />
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-slate-400 dark:border-white/10 dark:text-slate-500">
              <ImageOff size={22} strokeWidth={1.5} />
              <span className="text-xs font-medium">
                Este pago se hizo en el local, sin comprobante adjunto.
              </span>
            </div>
          )}
        </figure>

        {abono.estado === 'Pendiente' && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-xs font-medium text-amber-600 dark:text-amber-400">
            Un asesor está validando la consignación. Al confirmarla, el saldo de tu crédito se
            actualiza.
          </p>
        )}
      </div>
    </Modal>
  );
}
