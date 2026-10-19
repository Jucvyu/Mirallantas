import { CheckCircle2, MessageCircle, Phone } from 'lucide-react';
import Modal from '../../components/base/Modal';

// Datos de contacto de la empresa (los mismos del footer de la landing).
const TELEFONO = '+57 310 897 69 43';
const WHATSAPP = '310 897 6943';

/**
 * Aviso que se muestra al enviar el pedido-cotización.
 *
 * La cotización no queda valorada en el acto: un asesor la revisa y define
 * el precio, así que aquí se le da al cliente el número al que debe
 * comunicarse para continuar el proceso.
 */
export default function CotizacionEnviadaModal({ credito = null, onClose }) {
  return (
    <Modal
      title="¡Cotización enviada!"
      subtitle="Ya quedó registrada en el sistema."
      icon={<CheckCircle2 size={17} />}
      size="md"
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300"
        >
          Entendido
        </button>
      )}
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Tu pedido quedó registrado con los precios del catálogo y las llantas quedaron
          apartadas. Un asesor lo revisa y se comunica contigo para coordinar la entrega.
        </p>

        {/* ---- Datos de contacto ---- */}
        <div className="space-y-2">
          <a
            href={`tel:${TELEFONO.replace(/\s/g, '')}`}
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400">
              <Phone size={18} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Teléfono
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{TELEFONO}</p>
            </div>
          </a>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-whatsapp/15 text-brand-whatsapp">
              <MessageCircle size={18} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                WhatsApp
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{WHATSAPP}</p>
            </div>
          </div>
        </div>

        {/* ---- Resumen del crédito solicitado ---- */}
        {credito && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Crédito solicitado
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Valor</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">{credito.valor}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Plazo</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">{credito.plazo} días</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Cuota inicial abonada</dt>
                <dd className="font-bold text-emerald-600 dark:text-emerald-400">{credito.inicial}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Cuota aproximada</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">{credito.cuota}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Tu solicitud de crédito quedó en revisión. Cuando un asesor la apruebe, el crédito
              aparecerá en "Mi cartera" y se descontará de tu saldo usable.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
