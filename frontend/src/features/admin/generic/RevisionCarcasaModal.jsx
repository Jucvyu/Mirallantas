import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from '../../../components/base/formStyles';
import { MAX_TEXTO, MINIMO_EXPLICACION } from '../../../utils/validaciones';

/**
 * Revisión de la carcasa de una solicitud de reencauche: el asesor la
 * califica "Apta" (la aprueba: desde ahí sus datos ya no se editan) o
 * "No apta". Siempre lleva su observación y, si es apta, si el servicio
 * tendrá garantía. Sin esta revisión el reencauche no avanza. "No apta"
 * cancela el reencauche, con la observación como motivo.
 *
 * La revisión se registra una sola vez: ya revisada, el modal solo la muestra.
 *
 * `onConfirmar({ estadoEvidencia, observacionRevision, garantia })` devuelve
 * una promesa: si falla, el error se muestra y el modal sigue abierto.
 */
export default function RevisionCarcasaModal({ solicitud, aviso, onConfirmar, onClose }) {
  const [estado, setEstado] = useState('Apta');
  const [observacion, setObservacion] = useState(solicitud.observacionRevision ?? '');
  // Sin valor por defecto: el asesor debe decidir si lleva garantía
  const [garantia, setGarantia] = useState(null);
  const [tocado, setTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const falta = !observacion.trim()
    ? 'Escribe la observación de la revisión.'
    : observacion.trim().length < MINIMO_EXPLICACION
      ? `La observación debe tener al menos ${MINIMO_EXPLICACION} caracteres.`
      : '';
  const faltaGarantia = estado === 'Apta' && garantia === null ? 'Indica si el servicio lleva garantía.' : '';

  if (solicitud.estadoEvidencia !== 'Pendiente de revisión') return <RevisionRegistrada solicitud={solicitud} onClose={onClose} />;

  const confirmar = async (cerrar) => {
    setTocado(true);
    if (falta || faltaGarantia || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await onConfirmar({
        estadoEvidencia: estado,
        observacionRevision: observacion.trim(),
        ...(estado === 'Apta' ? { garantia } : {}),
      });
      cerrar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const opcion = (valor, activo) =>
    `flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
      activo
        ? valor === 'Apta'
          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-red-400 bg-red-500/10 text-red-600 dark:text-red-400'
        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
    }`;

  return (
    <Modal
      title="Revisar la carcasa"
      subtitle={`${solicitud.id} · ${solicitud.cantidad} llantas · ${solicitud.medidas || 'sin medidas'}`}
      icon={<ClipboardCheck size={17} />}
      size="sm"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => confirmar(cerrar)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
          >
            <ClipboardCheck size={15} /> {guardando ? 'Guardando…' : estado === 'Apta' ? 'Aprobar solicitud' : 'Marcar no apta'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <AvisoError mensaje={error} />
        {aviso && (
          <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            {aviso}
          </p>
        )}
        <div className="flex gap-2" role="radiogroup">
          {['Apta', 'No apta'].map((valor) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={estado === valor}
              onClick={() => setEstado(valor)}
              className={opcion(valor, estado === valor)}
            >
              {valor === 'Apta' ? 'Apta (aprobar)' : 'No apta'}
            </button>
          ))}
        </div>
        <p className={`text-xs ${estado === 'Apta' ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-red-500'}`}>
          {estado === 'Apta'
            ? 'Al aprobarla, los datos de la llanta (medidas, cantidad, fotos y descripción) ya no se podrán editar.'
            : 'El reencauche se cancelará y la observación quedará como el motivo de la cancelación (el cliente la verá).'}
        </p>
        <p className="text-[11px] text-slate-400">La revisión se registra una sola vez.</p>
        {estado === 'Apta' && (
          <div>
            <span className={LABEL}>
              ¿El servicio lleva garantía? <span className="text-red-500">*</span>
            </span>
            <div className="flex gap-2" role="radiogroup">
              {[
                [true, 'Sí, con garantía'],
                [false, 'Sin garantía'],
              ].map(([valor, texto]) => (
                <button
                  key={texto}
                  type="button"
                  role="radio"
                  aria-checked={garantia === valor}
                  onClick={() => setGarantia(valor)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                    garantia === valor
                      ? 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400'
                      : tocado && faltaGarantia
                        ? 'border-red-400 text-slate-500'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
            {tocado && faltaGarantia && <p className="mt-1 text-xs font-medium text-red-500">{faltaGarantia}</p>}
            <p className="mt-1 text-[11px] text-slate-400">El cliente lo verá en el detalle de su servicio.</p>
          </div>
        )}
        <div>
          <label htmlFor="revision-observacion" className={LABEL}>
            Observación <span className="text-red-500">*</span>
          </label>
          <textarea
            id="revision-observacion"
            rows={3}
            maxLength={MAX_TEXTO}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            onBlur={() => setTocado(true)}
            placeholder={estado === 'Apta' ? 'Ej.: carcasa sana, sin cortes ni abultamientos' : 'Ej.: separación de capas en el costado'}
            className={`${INPUT} ${tocado && falta ? BORDER_ERR : BORDER_OK} resize-none`}
          />
          {tocado && falta && <p className="mt-1 text-xs font-medium text-red-500">{falta}</p>}
        </div>
      </div>
    </Modal>
  );
}

/** Revisión ya registrada: solo se consulta. */
function RevisionRegistrada({ solicitud, onClose }) {
  const apta = solicitud.estadoEvidencia === 'Apta';
  const garantia = solicitud.garantia === true || solicitud.garantia === 'Sí';
  const filas = [
    ['Resultado', apta ? 'Apta (aprobada)' : 'No apta'],
    ...(apta ? [['Garantía', garantia ? 'Sí, con garantía' : 'Sin garantía']] : []),
    ['Observación', solicitud.observacionRevision || '—'],
    ...(solicitud.estado === 'Cancelado' ? [['Reencauche', 'Cancelado por la revisión']] : []),
  ];
  return (
    <Modal
      title="Revisión de la carcasa"
      subtitle={`${solicitud.id} · ${solicitud.cantidad} llantas · ${solicitud.medidas || 'sin medidas'}`}
      icon={<ClipboardCheck size={17} />}
      size="sm"
      onClose={onClose}
      footer={(cerrar) => (
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
        >
          Cerrar
        </button>
      )}
    >
      <dl className="space-y-3 text-sm">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
            <dd
              className={`mt-0.5 font-medium ${
                etiqueta === 'Resultado'
                  ? apta
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {valor}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
