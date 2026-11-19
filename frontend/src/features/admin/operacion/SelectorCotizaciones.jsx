import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import Badge from '../../../components/base/Badge';
import Dropdown from '../../../components/base/Dropdown';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useRecurso } from '../../../hooks/useRecurso';
import { cotizacionesService } from '../../../services';
import { hoyISO } from '../../../utils/formato';
import { SkeletonLineas } from '../../../components/base/Skeleton';

const CAMPO = `${INPUT} ${BORDER_OK} py-2`;

/**
 * Listado de cotizaciones-pedido para elegir una.
 *
 * Sustituye al desplegable de solo códigos: el asesor ve el cliente, la
 * fecha y el total, y acota con el buscador, la fecha o el cliente.
 * `filtro` permite restringir de antemano qué cotizaciones se ofrecen (por
 * ejemplo, solo las aprobadas al registrar una compra).
 *
 * Las cotizaciones las entrega el servicio de cotizaciones. `onChange`
 * recibe la fila elegida, sin sus líneas: quien las necesite las pide.
 * `totalDe(c)` cambia el valor que se muestra (por defecto, el total).
 */
export default function SelectorCotizaciones({ value, onChange, error, filtro, vacioLabel, totalDe = (c) => c.total }) {
  const [query, setQuery] = useState('');
  const [fecha, setFecha] = useState('');
  const [cliente, setCliente] = useState([]);
  const cotizaciones = useRecurso(cotizacionesService);

  const disponibles = useMemo(
    () => (filtro ? cotizaciones.filas.filter(filtro) : cotizaciones.filas),
    [filtro, cotizaciones.filas],
  );

  // Clientes que realmente tienen cotizaciones, para no ofrecer opciones vacías
  const clientesConCotizacion = useMemo(
    () => [...new Set(disponibles.map((c) => c.cliente))].filter(Boolean),
    [disponibles],
  );

  const listado = useMemo(() => {
    const q = query.trim().toLowerCase();
    return disponibles.filter((c) => {
      const coincideTexto = !q || `${c.id} ${c.cliente} ${totalDe(c)}`.toLowerCase().includes(q);
      const coincideFecha = !fecha || c.fecha === fecha;
      const coincideCliente = !cliente.length || cliente.includes(c.cliente);
      return coincideTexto && coincideFecha && coincideCliente;
    });
  }, [disponibles, query, fecha, cliente, totalDe]);

  return (
    <div>
      {/* ---- Búsqueda y filtros ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por Nº, cliente o total..."
            className={`${CAMPO} pl-9 pr-3`}
          />
        </div>

        {/* Una cotización no puede tener fecha posterior a hoy (tampoco si se escribe a mano) */}
        <input
          type="date"
          value={fecha}
          max={hoyISO()}
          onChange={(e) => setFecha(e.target.value > hoyISO() ? hoyISO() : e.target.value)}
          aria-label="Filtrar por fecha"
          className={`${CAMPO} px-3`}
          style={{ width: 'auto' }}
        />

        <Dropdown
          label="Cliente"
          multiple
          value={cliente}
          options={clientesConCotizacion}
          onChange={setCliente}
        />
      </div>

      {/* ---- Listado seleccionable ---- */}
      <ul
        role="radiogroup"
        aria-label="Cotización-pedido"
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
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {c.cliente} · {c.fecha}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {totalDe(c)}
                </span>
                <Badge>{c.estado}</Badge>
              </button>
            </li>
          );
        })}

        {listado.length === 0 && cotizaciones.cargando && (
          <li className="p-4">
            <SkeletonLineas lineas={4} />
          </li>
        )}
        {listado.length === 0 && !cotizaciones.cargando && (
          <li className="py-8 text-center text-sm text-slate-400">
            {vacioLabel ?? 'Ninguna cotización coincide con la búsqueda.'}
          </li>
        )}
      </ul>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
