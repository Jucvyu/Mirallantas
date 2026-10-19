import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Search, SlidersHorizontal } from 'lucide-react';
import Dropdown from '../Dropdown';
import { INPUT } from '../formStyles';
import EmptyState from '../EmptyState';

/**
 * Listado en formato de cartas para el portal de cliente.
 *
 * - Buscador sobre los campos indicados en `searchKeys` (o sobre todos).
 * - Filtros por campo: cada uno arma sus opciones a partir de los datos y
 *   admite varias marcadas a la vez (la carta entra si coincide con
 *   cualquiera). Un filtro puede traer su propio `match(item, valor)`
 *   cuando el dato no está plano en el objeto (p. ej. el estado de la
 *   entrega).
 * - Orden opcional mediante `sortOptions`.
 * - Paginación: solo aparece cuando hay más registros que `pageSize` (10).
 *
 * items: array de objetos con `id`
 * renderCard(item): nodo de la carta
 * filters: [{ key, label, options?, match? }]
 * sortOptions: [{ value, label, compare(a, b) }] — la primera es la de arranque
 * stickyToolbar: mantiene la barra de búsqueda visible al hacer scroll
 */
export default function CardList({
  items,
  renderCard,
  searchKeys,
  filters = [],
  sortOptions = [],
  pageSize = 10,
  columns = 'sm:grid-cols-2 xl:grid-cols-3',
  stickyToolbar = false,
  emptyIcon = 'Inbox',
  emptyTitle = 'Sin registros',
  emptyDescription,
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState({});
  const [orden, setOrden] = useState(sortOptions[0]?.value ?? '');
  const [page, setPage] = useState(1);

  // ---- Opciones de cada filtro: las declaradas o las que haya en los datos ----
  const options = useMemo(
    () =>
      filters.map((f) => ({
        ...f,
        options: f.options ?? [...new Set(items.map((i) => i[f.key]).filter(Boolean))],
      })),
    [filters, items],
  );

  // ---- Búsqueda + filtros + orden --------------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const resultado = items.filter((item) => {
      const matchesQuery =
        !q ||
        (searchKeys ?? Object.keys(item)).some((k) => String(item[k] ?? '').toLowerCase().includes(q));

      const matchesFilters = Object.entries(active).every(([k, valores]) => {
        if (!valores?.length) return true;
        const definicion = filters.find((f) => f.key === k);
        // Un filtro con `match` decide por su cuenta (datos anidados)
        if (definicion?.match) return valores.some((v) => definicion.match(item, v));
        return valores.includes(String(item[k]));
      });

      return matchesQuery && matchesFilters;
    });

    const criterio = sortOptions.find((o) => o.value === orden);
    return criterio ? [...resultado].sort(criterio.compare) : resultado;
  }, [items, query, active, searchKeys, filters, orden, sortOptions]);

  const paginated = filtered.length > pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageItems = paginated ? filtered.slice((current - 1) * pageSize, current * pageSize) : filtered;

  const setFilter = (key, value) => {
    setActive((a) => ({ ...a, [key]: value }));
    setPage(1);
  };

  // La barra fija se difumina sobre el fondo para no robarle protagonismo
  // a las cartas mientras el cliente hace scroll.
  const toolbarClass = stickyToolbar
    ? 'sticky top-[60px] z-10 -mx-1 rounded-xl bg-slate-50/80 px-1 py-2 backdrop-blur-sm dark:bg-brand-navy-900/80'
    : '';

  const controlClass = stickyToolbar
    ? 'border-slate-200/70 bg-white/70 focus:border-amber-400 dark:border-white/5 dark:bg-brand-navy-800/60'
    : 'border-slate-200 bg-white hover:border-slate-300 focus:border-amber-400 dark:border-white/10 dark:bg-brand-navy-800 dark:hover:border-white/20';

  return (
    <div>
      {/* ---- Barra de búsqueda, filtros y orden ---- */}
      <div className={toolbarClass}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar..."
              className={`${INPUT} ${controlClass} py-2 pl-9 pr-3`}
            />
          </div>

          {options.map((f) => (
            <Dropdown
              key={f.key}
              label={f.label}
              multiple
              value={active[f.key] ?? []}
              options={f.options}
              onChange={(valores) => setFilter(f.key, valores)}
              icon={<SlidersHorizontal size={13} className="shrink-0 opacity-70" />}
              subtle={stickyToolbar}
            />
          ))}

          {sortOptions.length > 0 && (
            <Dropdown
              label="Orden"
              value={sortOptions.find((o) => o.value === orden)?.label ?? ''}
              options={sortOptions.map((o) => o.label)}
              allLabel={sortOptions[0].label}
              onChange={(etiqueta) => {
                const elegido = sortOptions.find((o) => o.label === etiqueta) ?? sortOptions[0];
                setOrden(elegido.value);
                setPage(1);
              }}
              icon={<ArrowDownWideNarrow size={13} className="shrink-0 opacity-70" />}
              subtle={stickyToolbar}
            />
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        {paginated && ` · página ${current} de ${totalPages}`}
      </p>

      {/* ---- Cartas ----
          `items-start` evita que una carta desplegada estire a las demás
          de su misma fila: cada una conserva su altura. */}
      {pageItems.length > 0 ? (
        <div className={`mt-3 grid grid-cols-1 items-start gap-4 ${columns}`}>{pageItems.map(renderCard)}</div>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800">
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        </div>
      )}

      {/* ---- Paginación — solo si se supera el tamaño de página ---- */}
      {paginated && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={current === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                n === current
                  ? 'bg-amber-400 text-slate-900'
                  : 'border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={current === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
