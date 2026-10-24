import { useState } from 'react';
import { Check, Copy, Landmark } from 'lucide-react';
import { CUENTA_TRANSFERENCIA } from '../../config';
import Tooltip from '../../components/base/Tooltip';

/**
 * Cuenta de la empresa a la que el cliente transfiere. Se muestra al elegir
 * "Transferencia" como medio de pago, con un botón para copiar el número.
 * Los datos salen de la configuración (VITE_CUENTA_*); mientras falte el
 * número se avisa que se pidan al asesor.
 */
export default function DatosTransferencia() {
  const [copiado, setCopiado] = useState(false);
  const { banco, tipo, numero, titular, documento } = CUENTA_TRANSFERENCIA;
  if (!numero) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <Landmark size={14} className="shrink-0" /> Pide al asesor los datos de la cuenta para hacer la transferencia.
      </p>
    );
  }

  const copiar = () => {
    navigator.clipboard
      ?.writeText(numero.replace(/\s/g, ''))
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200">
      <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
        <Landmark size={14} /> Transfiere a esta cuenta
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {[banco, tipo].filter(Boolean).join(' · ')}
          </p>
          <p className="font-mono text-sm font-bold tracking-wide">{numero}</p>
          {titular && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {titular}
              {documento ? ` · ${documento}` : ''}
            </p>
          )}
        </div>
        <Tooltip texto="Copiar el número de cuenta para pegarlo en tu banco">
          <button
            type="button"
            onClick={copiar}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/60 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-400/20 dark:text-amber-300"
          >
            {copiado ? <Check size={12} /> : <Copy size={12} />} {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </Tooltip>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">Después adjunta el comprobante de la transferencia.</p>
    </div>
  );
}
