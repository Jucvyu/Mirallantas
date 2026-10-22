import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Dropdown from '../../components/base/Dropdown';
import LiquidGlass from '../../components/base/LiquidGlass';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_OK, INPUT } from '../../components/base/formStyles';
import Skeleton from '../../components/base/Skeleton';

const FILTROS = [
  { key: 'marca', label: 'Marca' },
  { key: 'tipoVehiculo', label: 'Tipo vehículo' },
  { key: 'medidas', label: 'Medida' },
  { key: 'categoria', label: 'Categoría' },
];

/**
 * Listado del catálogo de llantas: buscador, filtros y tarjetas. Lo usan el
 * portal del cliente (con el carro de cotización) y el catálogo público del
 * landing (sin sesión). No muestra precios ni stock: el precio se confirma
 * en la cotización.
 *
 *   productos   filas ya cargadas (solo activas)
 *   accion(p)   lo que va al pie de cada tarjeta (agregar al carro, iniciar sesión…)
 *   columnas    clases de la grilla
 *   limite      (opcional) cuántas tarjetas mostrar antes del botón "Ver más";
 *               sin él se muestran todas (portal y catálogo público)
 */
export default function CatalogoListado({ productos, cargando, error, accion, columnas, limite }) {
  const [query, setQuery] = useState('');
  const [mostrar, setMostrar] = useState(limite);
  // Cada filtro guarda un arreglo: se pueden marcar varias opciones
  const [activos, setActivos] = useState({});

  const opciones = useMemo(
    () => FILTROS.map((f) => ({ ...f, options: [...new Set(productos.map((p) => p[f.key]).filter(Boolean))] })),
    [productos],
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productos.filter((p) => {
      const coincide = !q || `${p.nombre} ${p.marca} ${p.medidas} ${p.codigo}`.toLowerCase().includes(q);
      const pasaFiltros = Object.entries(activos).every(([k, v]) => !v?.length || v.includes(p[k]));
      return coincide && pasaFiltros;
    });
  }, [productos, query, activos]);

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {cargando ? <Skeleton className="inline-block h-4 w-36 align-middle" /> : `${filtrados.length} de ${productos.length} productos`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, marca, medida o código..."
            className={`${INPUT} ${BORDER_OK} pl-9`}
          />
        </div>
        {opciones.map((f) => (
          <Dropdown
            key={f.key}
            label={f.label}
            multiple
            value={activos[f.key] ?? []}
            options={f.options}
            onChange={(valores) => setActivos((a) => ({ ...a, [f.key]: valores }))}
            icon={<SlidersHorizontal size={13} className="shrink-0 opacity-70" />}
          />
        ))}
      </div>

      <div className="mt-4">
        <AvisoError mensaje={error} />
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-4 sm:gap-5 ${columnas}`}>
        {cargando &&
          productos.length === 0 &&
          Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800"
            >
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-4 h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        {(mostrar ? filtrados.slice(0, mostrar) : filtrados).map((p, i) => (
          // Lista larga: vidrio sin desenfoque (más barato con muchas tarjetas)
          <LiquidGlass
            key={p.id}
            as="article"
            variante="pastel"
            blur={false}
            inclinacion={4}
            indice={Math.min(i, 8)}
            className="flex flex-col overflow-hidden"
          >
            <TireThumb
              brand={p.marca}
              foto={p.foto}
              badge={p.categoria}
              badgeColor={p.colorCategoria ?? undefined}
              className="h-32 w-full"
            />
            <div className="flex flex-1 flex-col p-4">
              <p className="text-xs font-bold tracking-wide text-amber-700 dark:text-amber-400">{p.marca.toUpperCase()}</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{p.nombre}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {p.medidas} · {p.tipoVehiculo || 'Uso general'} · {p.codigo}
              </p>
              {p.descripcion && (
                <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{p.descripcion}</p>
              )}
              <div className="mt-auto pt-4">{accion(p)}</div>
            </div>
          </LiquidGlass>
        ))}
      </div>

      {mostrar && filtrados.length > mostrar && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setMostrar((m) => m + limite)}
            className="ml-pulsable rounded-full border border-amber-400 px-6 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-400/10 dark:text-amber-400"
          >
            Ver más ({filtrados.length - mostrar})
          </button>
        </div>
      )}

      {!cargando && filtrados.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-600 dark:text-slate-400">
          {productos.length === 0 ? 'Todavía no hay llantas en el catálogo.' : 'Ningún producto coincide con la búsqueda.'}
        </p>
      )}
    </div>
  );
}
