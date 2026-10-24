import { useState } from 'react';
import { Ban } from 'lucide-react';
import AvisoError from './AvisoError';
import Modal from './Modal';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from './formStyles';

/** Mínimo de caracteres del motivo: que explique algo, no solo "no". */
const MINIMO = 10;

/**
 * Pide el motivo antes de una acción que lo exige (rechazar, cancelar).
 *
 * `onConfirm(motivo)` puede devolver una promesa (la llamada a la API): el
 * modal espera, y si falla muestra el error en vez de cerrarse.
 */
export default function MotivoModal({ title, message, record, label = 'Motivo', confirmLabel = 'Confirmar', onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [tocado, setTocado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const problema = motivo.trim().length < MINIMO ? `Escribe el motivo (mínimo ${MINIMO} caracteres).` : '';

  const confirmar = async (close) => {
    setTocado(true);
    if (problema || procesando) return;
    setProcesando(true);
    setError('');
    try {
      await onConfirm(motivo.trim());
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle={message}
      icon={<Ban size={17} />}
      tone="danger"
      size="sm"
      onClose={onClose}
      footer={(close) => (
        <>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={procesando}
            onClick={() => confirmar(close)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-red-500/30 hover:bg-red-600 disabled:cursor-wait disabled:opacity-60"
          >
            <Ban size={15} /> {procesando ? 'Procesando…' : confirmLabel}
          </button>
        </>
      )}
    >
      <AvisoError mensaje={error} className="mb-3" />
      {record && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-500/20 dark:bg-red-500/5">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{record.title}</p>
          {record.subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{record.subtitle}</p>}
        </div>
      )}
      <label htmlFor="motivo-modal" className={LABEL}>
        {label} <span className="text-red-500">*</span>
      </label>
      <textarea
        id="motivo-modal"
        rows={3}
        maxLength={300}
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        onBlur={() => setTocado(true)}
        aria-invalid={Boolean(tocado && problema)}
        className={`${INPUT} ${tocado && problema ? BORDER_ERR : BORDER_OK} resize-none`}
      />
      {tocado && problema && <p className="mt-1 text-xs font-medium text-red-500">{problema}</p>}
    </Modal>
  );
}
