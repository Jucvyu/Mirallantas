import { CheckCircle2, MessageCircle, Phone } from 'lucide-react';
import Modal from '../../components/base/Modal';

import { TELEFONO_EMPRESA as TELEFONO, WHATSAPP_EMPRESA } from '../../config';

// WhatsApp tal como se muestra: sin el indicativo del país
const WHATSAPP = WHATSAPP_EMPRESA.replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');

/**
 * Aviso que se muestra SOLO cuando la API confirma que la solicitud de
 * cotización quedó registrada.
 *
 * La solicitud no tiene precios todavía: un asesor los confirma con los
 * proveedores (plazo de respuesta de 24 horas, distinto de los 8 días de
 * vigencia de la cotización formal). Enviarla no es una compra.
 */
export default function CotizacionEnviadaModal({ numero, onClose }) {
  return (
    <Modal
      title="¡Solicitud recibida!"
      subtitle={numero ? `Solicitud ${numero}` : 'Ya quedó registrada en el sistema.'}
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
          ¡Tu solicitud de cotización fue recibida correctamente! Estamos verificando los precios vigentes con
          nuestros proveedores para ofrecerte una cotización actualizada. En un plazo de hasta 24 horas te
          confirmaremos los precios finales y las condiciones de tu solicitud. Ten en cuenta que el envío de esta
          solicitud no constituye una compra confirmada.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Puedes consultar el estado de tu solicitud en "Mis cotizaciones". Si tienes dudas, comunícate con
          nosotros:
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

      </div>
    </Modal>
  );
}
