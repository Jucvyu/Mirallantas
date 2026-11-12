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

/** Hasta cuántas medidas se muestran como botones; con más, una lista. */
const MAXIMO_BOTONES = 6;

const siNo = (v) => (v === true ? 'Sí' : v === false ? 'No' : null);
const numero = (v, unidad) => (v === null || v === undefined || v === '' ? null : `${Number(v).toLocaleString('es-CO')} ${unidad}`);

/** Ficha técnica del modelo: solo los datos que estén cargados. */
const fichaDe = (p) =>
  [
    ['Uso', p.uso],
    ['Posición', p.posicion],
    ['Construcción', p.construccion],
    ['Labrado', p.labrado],
    ['Sin cámara', siNo(p.sinCamara)],
    ['Recauchable', siNo(p.recauchable)],
    ['Garantía', p.garantiaMeses === null || p.garantiaMeses === undefined || p.garantiaMeses === '' ? null : `${p.garantiaMeses} meses`],
    ['Origen', p.paisOrigen],
  ].filter(([, valor]) => valor);

/** Datos de la medida elegida. */
const datosDeMedida = (r) =>
  [
    ['Índice de carga', r.indiceCarga],
    ['Lonas', r.lonas ? `${r.lonas} PR` : null],
    ['Labrado', numero(r.profundidadLabrado, 'mm')],
    ['Peso', numero(r.pesoKg, 'kg')],
  ].filter(([, valor]) => valor);

/**
 * Agrupa las referencias por modelo: una tarjeta por llanta con todas sus
 * medidas. La llanta reencauchada es una unidad única: va sola.
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

/** Lista de pares etiqueta / valor, compacta. */
function Datos({ filas, titulo }) {
  if (!filas.length) return null;
  return (
    <div className="mt-3">
      {titulo && <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{titulo}</p>}
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-snug">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="min-w-0">
            <dt className="text-slate-500 dark:text-slate-400">{etiqueta}</dt>
            <dd className="truncate font-semibold text-slate-800 dark:text-slate-100" title={valor}>
              {valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Selector de la medida de un modelo: botones si son pocas, lista si son muchas. */
function SelectorMedida({ referencias, elegida, onElegir, nombre }) {
  if (referencias.length === 1) {
    return <p className="mt-2 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">{referencias[0].medidas}</p>;
  }
  if (referencias.length > MAXIMO_BOTONES) {
    return (
      <select
        value={elegida.id}
        onChange={(e) => onElegir(Number(e.target.value))}
        aria-label={`Medida de ${nombre}`}
        className={`${INPUT} ${BORDER_OK} mt-2 !py-1.5 text-xs tabular-nums`}
      >
        {referencias.map((r) => (
          <option key={r.id} value={r.id}>
            {r.medidas}
            {r.indiceCarga ? ` · ${r.indiceCarga}` : ''}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div role="group" aria-label={`Medida de ${nombre}`} className="mt-2 flex flex-wrap gap-1.5">
      {referencias.map((r) => {
        const activa = r.id === elegida.id;
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={activa}
            onClick={() => onElegir(r.id)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
              activa
                ? 'border-amber-400 bg-amber-400 text-slate-900'
                : 'border-slate-200 text-slate-600 hover:border-amber-400 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {r.medidas}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Listado del catálogo de llantas: buscador, filtros y tarjetas. Lo usan el
 * portal del cliente (con el carro de cotización), el catálogo público y el
 * landing (sin sesión). No muestra precios ni stock: el precio se confirma
 * en la cotización.
 *
 * Una tarjeta por llanta (modelo): se elige la medida y la tarjeta muestra
 * sus datos y la ficha técnica. Lo que se agrega al carro es esa medida.
 *
 *   productos   referencias ya cargadas (solo activas), en la forma plana de la API
 *   accion(p)   lo que va al pie de cada tarjeta, para la medida elegida
 *               (agregar al carro, iniciar sesión…)
 *   columnas    clases de la grilla
 *   limite      (opcional) cuántas tarjetas mostrar antes del botón "Ver más";
 *               sin él se muestran todas (portal y catálogo público)
 */
export default function CatalogoListado({ productos, cargando, error, accion, columnas, limite }) {
  const [query, setQuery] = useState('');
  const [mostrar, setMostrar] = useState(limite);
  // Cada filtro guarda un arreglo: se pueden marcar varias opciones
  const [activos, setActivos] = useState({});
  // Medida elegida en cada tarjeta: { claveDelGrupo: idDeLaReferencia }
  const [elegidas, setElegidas] = useState({});

  const opciones = useMemo(
    () => FILTROS.map((f) => ({ ...f, options: [...new Set(productos.map((p) => p[f.key]).filter(Boolean))] })),
    [productos],
  );

  const grupos = useMemo(() => agrupar(productos), [productos]);

  // Una tarjeta entra si alguna de sus medidas cumple la búsqueda y los
  // filtros; el selector solo ofrece esas medidas.
  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cumple = (p) => {
      const coincide = !q || `${p.nombre} ${p.marca} ${p.medidas} ${p.codigo}`.toLowerCase().includes(q);
      const pasaFiltros = Object.entries(activos).every(([k, v]) => !v?.length || v.includes(p[k]));
      return coincide && pasaFiltros;
    };
    return grupos
      .map((g) => ({ ...g, referencias: g.referencias.filter(cumple) }))
      .filter((g) => g.referencias.length > 0);
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
        {visibles.map((g, i) => {
          const p = g.referencias.find((r) => r.id === elegidas[g.clave]) ?? g.referencias[0];
          const ficha = fichaDe(p);
          return (
            // Lista larga: vidrio sin desenfoque (más barato con muchas tarjetas)
            <LiquidGlass
              key={g.clave}
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
                  {p.tipoVehiculo || 'Uso general'} · {p.codigo}
                </p>
                {p.descripcion && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{p.descripcion}</p>
                )}

                <SelectorMedida
                  referencias={g.referencias}
                  elegida={p}
                  nombre={p.nombre}
                  onElegir={(id) => setElegidas((e) => ({ ...e, [g.clave]: id }))}
                />
                <Datos filas={datosDeMedida(p)} />
                <Datos filas={ficha} titulo="Ficha técnica" />

                {/* Llanta reencauchada: unidad única con precio fijo */}
                {p.reencauchada && (
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      Única unidad
                    </span>
                    {p.precioVentaValor > 0 && (
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        $ {Number(p.precioVentaValor).toLocaleString('es-CO')}
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-auto pt-4">{accion(p)}</div>
              </div>
            </LiquidGlass>
          );
        })}
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
