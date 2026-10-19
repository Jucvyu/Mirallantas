import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import Badge from '../../../components/base/Badge';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useRecurso } from '../../../hooks/useRecurso';
import { creditosService } from '../../../services';

const CAMPO = `${INPUT} ${BORDER_OK} py-2`;

/**
 * Listado de créditos para elegir uno.
 *
 * Es el equivalente al `SelectorPedidos` de las órdenes de compra: en vez
 * de un desplegable con los códigos sueltos, el asesor ve el cliente, el
 * cupo y el saldo de cada crédito y puede acotar con el buscador. Solo se
 * puede marcar uno.
 */
export default function SelectorCreditos({ value, onChange, error }) {
  const [query, setQuery] = useState('');
  // Los créditos los entrega el servicio de créditos
  const creditos = useRecurso(creditosService);

  const listado = useMemo(() => {
    // Un crédito pagado al 100 % ya no recibe abonos: no se ofrece
    const conSaldo = creditos.filas.filter((c) => Number(c.saldoValor) > 0);
    const q = query.trim().toLowerCase();
    if (!q) return conSaldo;
    return conSaldo.filter((c) => `${c.id} ${c.cliente} ${c.saldoPendiente}`.toLowerCase().includes(q));
  }, [query, creditos.filas]);

  return (
    <div>
      {/* ---- Búsqueda ---- */}
      <div className="relative mb-3">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por Nº de crédito o cliente..."
          className={`${CAMPO} pl-9 pr-3`}
        />
      </div>

      {/* ---- Listado seleccionable ---- */}
      <ul
        role="radiogroup"
        aria-label="Crédito"
        className={`max-h-64 space-y-2 overflow-y-auto rounded-xl border p-2 ${
          error ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
        }`}
      >
        {listado.map((c) => {
          const activo = c.id === value;
          return (
            <li key={c.id}>
              <button
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => onChange(c)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  activo
                    ? 'border-amber-400 bg-amber-400/10'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    activo ? 'border-amber-400 bg-amber-400' : 'border-slate-300 dark:border-white/20'
                  }`}
                >
                  {activo && <Check size={10} className="text-slate-900" strokeWidth={3.5} />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{c.id}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.cliente}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.saldoPendiente}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">pendiente</p>
                </div>
                <Badge>{c.estado}</Badge>
              </button>
            </li>
          );
        })}

        {listado.length === 0 && (
          <li className="py-8 text-center text-sm text-slate-400">
            {creditos.cargando ? 'Cargando…' : 'Ningún crédito coincide con la búsqueda.'}
          </li>
        )}
      </ul>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
