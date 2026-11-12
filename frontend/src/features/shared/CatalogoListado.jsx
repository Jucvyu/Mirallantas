import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Dropdown from '../../components/base/Dropdown';
import LiquidGlass from '../../components/base/LiquidGlass';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_OK, INPUT } from '../../components/base/formStyles';
import Skeleton from '../../components/base/Skeleton';

const FILTROS = [
  { key: 'marca', label: 'Marca' },
  { key: 'tipoVehiculo', label: 'Tipo vehículo' },
  { key: 'posicion', label: 'Posición' },
  { key: 'medidas', label: 'Medida' },
  { key: 'categoria', label: 'Categoría' },
];

/**
 * Agrupa las referencias por producto (modelo): una tarjeta por llanta con
 * todas sus medidas. La llanta reencauchada es una unidad única: va sola.
 */
function agrupar(productos) {
  const grupos = new Map();
  for (const p of productos) {
    const clave = p.reencauchada || !p.modeloId ? `r${p.id}` : `m${p.modeloId}`;
    const grupo = grupos.get(clave) ?? { clave, base: p, referencias: [] };
    grupo.referencias.push(p);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

/** Resumen corto de las variantes: "3 medidas · Tracción, Direccional". */
function resumenVariantes(referencias) {
  const medidas = new Set(referencias.map((r) => r.medidas)).size;
  const posiciones = [...new Set(referencias.map((r) => r.posicion).filter(Boolean))];
  const texto = `${medidas} ${medidas === 1 ? 'medida' : 'medidas'}`;
  return { texto, posiciones };
}

/** Tarjeta de un producto: igual de alta que todas, sin ficha técnica. */
function Tarjeta({ grupo, indice, enlace, accion }) {
  const p = grupo.base;
  const { texto, posiciones } = resumenVariantes(grupo.referencias);
  const contenido = (
    <>
      <TireThumb brand={p.marca} foto={p.foto} badge={p.categoria} badgeColor={p.colorCategoria ?? undefined} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-bold tracking-wide text-amber-700 dark:text-amber-400">{p.marca.toUpperCase()}</p>
        <p className="mt-0.5 line-clamp-1 text-base font-bold text-slate-900 dark:text-white" title={p.nombre}>
          {p.reencauchada ? p.descripcion || p.nombre : p.nombre}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          {p.reencauchada ? `${p.medidas} · Llanta reencauchada` : p.tipoVehiculo || 'Uso general'}
        </p>

        {/* Una sola línea de datos: así todas las tarjetas miden lo mismo */}
        <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-1.5 overflow-hidden">
          {p.reencauchada ? (
            <>
              <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">Única unidad</span>
              {p.precioVentaValor > 0 && (
                <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  $ {Number(p.precioVentaValor).toLocaleString('es-CO')}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">{texto}</span>
              {posiciones.slice(0, 2).map((pos) => (
                <span key={pos} className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/15 dark:text-slate-300">
                  {pos}
                </span>
              ))}
            </>
          )}
        </div>

        <div className="mt-auto pt-4">
          {p.reencauchada ? (
            accion(p)
          ) : (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400 py-2 text-xs font-bold text-amber-700 transition-colors group-hover:bg-amber-400 group-hover:text-slate-900 dark:text-amber-400">
              Ver producto <ArrowRight size={14} aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    // Lista larga: vidrio sin desenfoque (más barato con muchas tarjetas)
    <LiquidGlass as="article" variante="pastel" blur={false} inclinacion={4} indice={Math.min(indice, 8)} className="group flex h-full flex-col overflow-hidden">
      {p.reencauchada ? (
        contenido
      ) : (
        <Link
          to={enlace(p.modeloId)}
          aria-label={`Ver ${p.marca} ${p.nombre}`}
          className="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {contenido}
        </Link>
      )}
    </LiquidGlass>
  );
}

/**
 * Catálogo de llantas: buscador, filtros y tarjetas. Lo usan el portal del
 * cliente, el catálogo público y el landing. No muestra precios ni stock:
 * el precio se confirma en la cotización.
 *
 * Una tarjeta por producto (modelo), todas del mismo alto. Al tocarla se
 * abre su página de detalle, donde se elige posición y medida y se ve la
 * ficha técnica. La llanta reencauchada (unidad única) se pide desde la
 * misma tarjeta.
 *
 *   productos   referencias ya cargadas (solo las que se venden), forma plana de la API
 *   enlace(id)  ruta del detalle de un producto (p. ej. /catalogo/12)
 *   accion(p)   pie de la tarjeta de una llanta reencauchada (agregar, iniciar sesión…)
 *   columnas    clases de la grilla
 *   limite      (opcional) cuántas tarjetas mostrar antes de "Ver más"
 */
export default function CatalogoListado({ productos, cargando, error, enlace, accion, columnas, limite }) {
  const [query, setQuery] = useState('');
  const [mostrar, setMostrar] = useState(limite);
  // Cada filtro guarda un arreglo: se pueden marcar varias opciones
  const [activos, setActivos] = useState({});

  const opciones = useMemo(
    () => FILTROS.map((f) => ({ ...f, options: [...new Set(productos.map((p) => p[f.key]).filter(Boolean))] })),
    [productos],
  );

  const grupos = useMemo(() => agrupar(productos), [productos]);

  // Un producto entra si alguna de sus medidas cumple la búsqueda y los filtros
  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cumple = (p) => {
      const coincide = !q || `${p.nombre} ${p.marca} ${p.medidas} ${p.codigo}`.toLowerCase().includes(q);
      const pasaFiltros = Object.entries(activos).every(([k, v]) => !v?.length || v.includes(p[k]));
      return coincide && pasaFiltros;
    };
    return grupos.filter((g) => g.referencias.some(cumple));
  }, [grupos, query, activos]);

  const visibles = mostrar ? filtrados.slice(0, mostrar) : filtrados;

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {cargando ? <Skeleton className="inline-block h-4 w-36 align-middle" /> : `${filtrados.length} de ${grupos.length} productos`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, marca, medida o código..."
            aria-label="Buscar en el catálogo"
            className={`${INPUT} ${BORDER_OK} pl-9`}
          />
        </div>
        {opciones.map((f) =>
          f.options.length ? (
            <Dropdown
              key={f.key}
              label={f.label}
              multiple
              value={activos[f.key] ?? []}
              options={f.options}
              onChange={(valores) => setActivos((a) => ({ ...a, [f.key]: valores }))}
              icon={<SlidersHorizontal size={13} className="shrink-0 opacity-70" />}
            />
          ) : null,
        )}
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
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-4 h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        {visibles.map((g, i) => (
          <Tarjeta key={g.clave} grupo={g} indice={i} enlace={enlace} accion={accion} />
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
