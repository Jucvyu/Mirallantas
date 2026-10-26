import { useState } from 'react';
import { ClipboardCheck, ExternalLink, Wrench } from 'lucide-react';
import Badge from '../../../components/base/Badge';
import Modal from '../../../components/base/Modal';

/**
 * Detalle de una solicitud de reencauche para el personal: las fotos de la
 * llanta en grande (para analizarlas bien) y sus datos. Si la carcasa aún
 * no se revisa, desde aquí se abre la revisión (`onRevisar`).
 */
export default function DetalleSolicitudServicioModal({ solicitud, onRevisar, onClose }) {
  const fotos = solicitud.fotos ?? [];
  const [actual, setActual] = useState(0);
  const pendiente = solicitud.estadoEvidencia === 'Pendiente de revisión' && solicitud.estado !== 'Cancelado';
  const apta = solicitud.estadoEvidencia === 'Apta';

  const datos = [
    ['Cotización', solicitud.cotizacion || 'Sin cotización'],
    ['Cantidad', `${solicitud.cantidad} llantas`],
    ['Medidas', solicitud.medidas || '—'],
    ['Estado', solicitud.estado],
    ['Carcasa', solicitud.estadoEvidencia],
    ...(apta ? [['Garantía', solicitud.garantia === 'Sí' || solicitud.garantia === true ? 'Con garantía' : 'Sin garantía']] : []),
    ['Valor', solicitud.precio || 'Sin precio'],
  ];

  return (
    <Modal
      title="Solicitud de reencauche"
      subtitle={`${solicitud.id} · ${solicitud.cantidad} llantas · ${solicitud.medidas || 'sin medidas'}`}
      icon={<Wrench size={17} />}
      size="xl"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
          >
            Cerrar
          </button>
          {pendiente && (
            <button
              type="button"
              onClick={() => {
                cerrar();
                onRevisar();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              <ClipboardCheck size={15} /> Revisar la carcasa
            </button>
          )}
        </>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ---- Fotos en grande ---- */}
        <section>
          {fotos.length > 0 ? (
            <>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-white/10">
                <img src={fotos[actual]} alt={`Foto ${actual + 1} de la llanta`} className="h-80 w-full object-contain sm:h-96" />
                <a
                  href={fotos[actual]}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white hover:bg-black/80"
                >
                  <ExternalLink size={12} /> Ver en tamaño real
                </a>
              </div>
              {fotos.length > 1 && (
                <div className="mt-2 flex gap-2">
                  {fotos.map((foto, i) => (
                    <button
                      key={foto}
                      type="button"
                      onClick={() => setActual(i)}
                      aria-label={`Ver la foto ${i + 1}`}
                      aria-pressed={i === actual}
                      className={`overflow-hidden rounded-lg border-2 transition-colors ${
                        i === actual ? 'border-amber-400' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={foto} alt="" className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="flex h-60 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-white/10">
              La solicitud no tiene fotos.
            </p>
          )}
        </section>

        {/* ---- Datos de la llanta y de la revisión ---- */}
        <section className="space-y-4 text-sm">
          <dl className="space-y-2">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-3 border-b border-slate-100 pb-2 dark:border-white/5">
                <dt className="text-slate-500 dark:text-slate-400">{etiqueta}</dt>
                <dd className="text-right font-semibold text-slate-800 dark:text-slate-100">
                  {etiqueta === 'Carcasa' || etiqueta === 'Estado' ? <Badge>{valor}</Badge> : valor}
                </dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Descripción del cliente</p>
            <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-200">{solicitud.descripcion || '—'}</p>
          </div>
          {solicitud.observacionRevision && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Observación de la revisión</p>
              <p className="mt-1 text-slate-700 dark:text-slate-200">{solicitud.observacionRevision}</p>
            </div>
          )}
          {solicitud.motivoCancelacion && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <span className="font-bold">Cancelado.</span> Motivo: {solicitud.motivoCancelacion}
            </p>
          )}
          {pendiente && (
            <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              Analiza las fotos y registra si la carcasa es apta con el botón "Revisar la carcasa".
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
