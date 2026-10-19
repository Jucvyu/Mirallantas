import { useState } from 'react';
import { Check, HandCoins, ImageOff, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useEnvio } from '../../../hooks/useEnvio';
import { solicitudesServicioService } from '../../../services';
import { TONO_PAGO } from './tonosPago';

/**
 * Pago de un servicio de reencauche (módulo Solicitudes de servicio).
 *
 * Muestra el valor asignado y el pago que hizo el cliente con su
 * comprobante. Desde aquí el asesor:
 *   · aprueba el pago (también si el cliente pagó en el local, sin
 *     comprobante) → el reencauche ya puede avanzar;
 *   · lo rechaza con el motivo → el cliente lo ve en rojo y vuelve a subirlo.
 * En los dos casos el cliente recibe una notificación.
 */
export default function DetallePagoServicioModal({ solicitud, onResuelto, onClose }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();
  const enRevision = solicitud.pagoEstado === 'En revisión';
  const puedeAprobar = enRevision || solicitud.pagoEstado === 'Por pagar';

  const resolver = (estado, cerrar) =>
    enviar(async () => {
      await solicitudesServicioService.revisarPago(solicitud, estado, motivo.trim());
      await onResuelto?.();
    }, cerrar);

  const pie = (cerrar) => {
    if (!puedeAprobar) {
      return (
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
        >
          Cerrar
        </button>
      );
    }
    if (rechazando) {
      return (
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
      );
    }
    return (
      <>
        {enRevision && (
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <X size={15} /> Rechazar pago
          </button>
        )}
        <button
          type="button"
          onClick={() => resolver('Aprobado', cerrar)}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Check size={15} /> {enRevision ? 'Aprobar pago' : 'Pagó en el local'}
        </button>
      </>
    );
  };

  return (
    <Modal
      title="Pago del servicio"
      subtitle={`${solicitud.id} · ${solicitud.cliente ?? ''}`}
      icon={<HandCoins size={17} />}
      size="md"
      onClose={onClose}
      footer={pie}
    >
      <div className="space-y-5">
        <AvisoError mensaje={errorEnvio} />

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor del servicio</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{solicitud.precio || 'Sin asignar'}</p>
          </div>
          <Badge tone={TONO_PAGO[solicitud.pagoEstado]}>{solicitud.pagoEstado}</Badge>
        </section>

        {solicitud.pagoEstado === 'Sin precio' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Primero asígnale un valor desde "Editar" (campo "Valor del servicio"). El cliente recibirá un aviso para pagarlo.
          </p>
        )}

        <section className="grid grid-cols-2 gap-3">
          {[
            { label: 'Cotización', valor: solicitud.cotizacion || '—' },
            { label: 'Servicio', valor: `${solicitud.servicio} · ${solicitud.cantidad} llantas` },
            { label: 'Medio de pago', valor: solicitud.pagoMedio || '—' },
            { label: 'Fecha del pago', valor: solicitud.pagoFecha || '—' },
          ].map(({ label, valor }) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{valor}</p>
            </div>
          ))}
        </section>

        {solicitud.pagoMotivo && (
          <p className="rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
            Rechazado: {solicitud.pagoMotivo}
          </p>
        )}

        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Comprobante
          </p>
          {solicitud.pagoComprobante ? (
            <a href={solicitud.pagoComprobante} target="_blank" rel="noreferrer" title="Abrir el comprobante completo">
              <img
                src={solicitud.pagoComprobante}
                alt={`Comprobante del pago de ${solicitud.id}`}
                className="max-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-white/10 dark:bg-white/5"
              />
            </a>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-white/10">
              <ImageOff size={22} strokeWidth={1.5} />
              {solicitud.pagoMedio === 'Efectivo' ? 'Pago en efectivo: sin comprobante.' : 'El cliente aún no ha subido el pago.'}
            </div>
          )}
        </section>

        {rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo del rechazo</span>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="El cliente lo verá y volverá a subir el comprobante."
              className={`${INPUT} ${BORDER_OK} mt-1.5 resize-none`}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
