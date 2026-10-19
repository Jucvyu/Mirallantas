import { Check, ShieldCheck, Wrench } from 'lucide-react';
import Badge from '../../components/base/Badge';
import Modal from '../../components/base/Modal';
import { estadosServicio } from '../../constantes';

// Avance de la solicitud de servicio. El estado "Cancelado" se sale del
// flujo normal, así que se muestra aparte.
const PASOS = estadosServicio.filter((e) => e !== 'Cancelado');

/**
 * Estado de la solicitud de reencauche de una línea de servicio.
 *
 * Se consulta desde el detalle del servicio dentro de su cotización: el
 * cliente ve en qué punto va la carcasa y qué reencauchadora la tiene.
 */
export default function ReencaucheModal({ solicitud, onClose }) {
  const cancelada = solicitud.estado === 'Cancelado';
  const pasoActual = PASOS.indexOf(solicitud.estado);

  return (
    <Modal
      title="Estado del reencauche"
      subtitle={`${solicitud.id} · ${solicitud.servicio}`}
      icon={<Wrench size={17} />}
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
      <div className="space-y-6">
        {/* ---- Cabecera: reencauchadora y estado ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {solicitud.tercero || 'Reencauchadora sin asignar'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {solicitud.servicio} · {solicitud.cantidad}{' '}
              {solicitud.cantidad === 1 ? 'llanta' : 'llantas'}
            </p>
          </div>
          <Badge>{solicitud.estado}</Badge>
        </div>

        {/* ---- Avance del servicio ---- */}
        {cancelada ? (
          <p className="rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
            El servicio fue cancelado: la reencauchadora o el cliente no continuaron con el proceso.
          </p>
        ) : (
          <ol className="space-y-3">
            {PASOS.map((paso, i) => {
              const hecho = i <= pasoActual;
              return (
                <li key={paso} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      hecho
                        ? 'bg-emerald-500 text-white'
                        : 'border border-slate-300 text-slate-400 dark:border-white/20'
                    }`}
                  >
                    {hecho ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      hecho ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {paso}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* ---- Ficha técnica ---- */}
        <dl className="space-y-2.5 border-t border-slate-200 pt-5 text-sm dark:border-white/10">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Medidas</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100">{solicitud.medidas || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Fecha de recepción</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100">{solicitud.fecha}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Tiempo estimado</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100">
              {solicitud.tiempoEstimado || 'Por definir'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Estado de la carcasa</dt>
            <dd>
              <Badge>{solicitud.estadoEvidencia}</Badge>
            </dd>
          </div>
        </dl>

        {/* ---- Garantía ---- */}
        <p
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            solicitud.garantia === 'Sí'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
              : 'border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400'
          }`}
        >
          <ShieldCheck size={14} className="shrink-0" />
          {solicitud.garantia === 'Sí'
            ? 'El servicio incluye garantía de la reencauchadora.'
            : 'Este servicio no incluye garantía.'}
        </p>
      </div>
    </Modal>
  );
}
