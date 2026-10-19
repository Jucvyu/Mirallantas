import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCredito } from '../../context/CreditoContext';

/**
 * Saldo usable del navbar, con un resumen de la cartera al pulsarlo.
 *
 * El chip siempre muestra el saldo; al abrirlo aparece lo mínimo que el
 * cliente necesita saber antes de seguir comprando —cupo, crédito abierto y
 * lo que debe— y un "Ver más" que lleva a Mi cartera, donde está el detalle
 * completo con los abonos y las solicitudes.
 */
export default function SaldoUsableMenu() {
  const { saldoUsableTexto, tieneCredito, credito, cupoTotal, comprometidoTexto } = useCredito();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  // Se cierra al hacer click fuera o con Escape, igual que el perfil
  useEffect(() => {
    if (!abierto) return undefined;
    const alClickFuera = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', alClickFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const filas = tieneCredito
    ? [
        ['Crédito abierto', credito?.id ?? '—'],
        ['Monto financiado', credito?.montoTotal ?? '—'],
        ['Saldo pendiente', comprometidoTexto],
      ]
    : [
        ['Cupo total', `$ ${cupoTotal.toLocaleString('es-CO')}`],
        ['Créditos abiertos', 'Ninguno'],
      ];

  return (
    <div ref={contenedor} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="true"
        title="Ver el resumen de mi cartera"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
          tieneCredito
            ? 'border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
        }`}
      >
        <Wallet size={12} /> Saldo usable: {saldoUsableTexto}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-brand-navy-800 dark:shadow-black/40">
          <div className="border-b border-slate-100 px-4 py-3.5 dark:border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Saldo usable
            </p>
            <p
              className={`text-lg font-bold ${
                tieneCredito ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {saldoUsableTexto}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {tieneCredito
                ? 'En negativo mientras tengas un crédito abierto.'
                : 'Disponible para financiar un pedido.'}
            </p>
          </div>

          <dl className="space-y-2.5 px-4 py-3.5">
            {filas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {etiqueta}
                </dt>
                <dd className="min-w-0 truncate text-right text-xs font-medium text-slate-700 dark:text-slate-200">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-slate-100 px-4 py-3 dark:border-white/10">
            <Link
              to="/portal/cartera"
              onClick={() => setAbierto(false)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-amber-300"
            >
              Ver más <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
