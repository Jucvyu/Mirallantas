import { useMemo, useState } from 'react';
import { Check, Info, Minus, Plus, Search, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import Dropdown from '../../components/base/Dropdown';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_OK, INPUT, soloDigitos } from '../../components/base/formStyles';
import { PLAZO_RESPUESTA_HORAS } from '../../constantes';
import { CANTIDAD_MAXIMA, useCart } from '../../context/CartContext';
import { useRecurso } from '../../hooks/useRecurso';
import { categoriasService, productosService } from '../../services';
import PedidoPanel from './PedidoPanel';

const FILTERS = [
  { key: 'marca', label: 'Marca' },
  { key: 'tipoVehiculo', label: 'Tipo vehículo' },
  { key: 'medidas', label: 'Medida' },
  { key: 'categoria', label: 'Categoría' },
];

/** Cantidad entre 1 y 999. */
const acotar = (n) => Math.min(CANTIDAD_MAXIMA, Math.max(1, Number(n) || 1));

/**
 * Catálogo de llantas del portal.
 *
 * Cada tarjeta muestra el rango de precio orientativo (lo calcula la API con
 * precios de venta reales; nunca el costo ni el stock). El cliente elige la
 * cantidad ahí mismo y la agrega a su carro de cotización, sin abrir
 * ventanas; el carro se ve a la derecha. El precio final se confirma
 * después de enviar la solicitud.
 */
export default function CatalogoPage() {
  const [query, setQuery] = useState('');
  // Cada filtro guarda un arreglo: se pueden marcar varias opciones
  const [active, setActive] = useState({});
  // Cantidad elegida en cada tarjeta (por defecto 1)
  const [cantidades, setCantidades] = useState({});
  const [added, setAdded] = useState(null);
  const [carroAbierto, setCarroAbierto] = useState(false);
  const cart = useCart();

  // A un cliente la API solo le envía los productos activos; si mira el
  // personal, se filtran aquí.
  const productos = useRecurso(productosService);
  const categorias = useRecurso(categoriasService);
  const catalogo = useMemo(() => productos.filas.filter((p) => p.activo), [productos.filas]);

  /** Color configurado para cada categoría desde la gestión del admin. */
  const colorCategoria = useMemo(
    () => Object.fromEntries(categorias.filas.map((c) => [c.nombre, c.color])),
    [categorias.filas],
  );

  const options = useMemo(
    () => FILTERS.map((f) => ({ ...f, options: [...new Set(catalogo.map((p) => p[f.key]).filter(Boolean))] })),
    [catalogo],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogo.filter((p) => {
      const matchesQuery = !q || `${p.nombre} ${p.marca} ${p.medidas} ${p.codigo}`.toLowerCase().includes(q);
      const matchesFilters = Object.entries(active).every(([k, v]) => !v?.length || v.includes(p[k]));
      return matchesQuery && matchesFilters;
    });
  }, [catalogo, query, active]);

  const cantidadDe = (id) => cantidades[id] ?? 1;
  const cambiarCantidad = (id, valor) => setCantidades((c) => ({ ...c, [id]: acotar(valor) }));

  const agregar = (producto) => {
    cart.addProducto(producto, cantidadDe(producto.id));
    setCarroAbierto(true);
    setAdded(producto.id);
    setCantidades((c) => ({ ...c, [producto.id]: 1 }));
    setTimeout(() => setAdded((id) => (id === producto.id ? null : id)), 1400);
  };

  const gridCols = carroAbierto ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className={carroAbierto ? 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6' : ''}>
      {/* Columna izquierda: el catálogo */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Catálogo de Llantas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {productos.cargando ? 'Cargando el catálogo…' : `${filtered.length} de ${catalogo.length} productos`}
            </p>
          </div>
          <button
            onClick={() => setCarroAbierto((v) => !v)}
            aria-expanded={carroAbierto}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 transition-colors hover:bg-amber-300"
          >
            <ShoppingCart size={16} /> Mi carro de cotización
            {cart.count > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-amber-400">
                {cart.count}
              </span>
            )}
          </button>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <Info size={15} className="mt-px shrink-0 text-amber-500" />
          Los precios son orientativos. Agrega las llantas que necesitas y envía tu solicitud: confirmamos el precio
          final con nuestros proveedores en un plazo de hasta {PLAZO_RESPUESTA_HORAS} horas.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, marca, medida o código..."
              className={`${INPUT} ${BORDER_OK} pl-9`}
            />
          </div>
          {options.map((f) => (
            <Dropdown
              key={f.key}
              label={f.label}
              multiple
              value={active[f.key] ?? []}
              options={f.options}
              onChange={(valores) => setActive((a) => ({ ...a, [f.key]: valores }))}
              icon={<SlidersHorizontal size={13} className="shrink-0 opacity-70" />}
            />
          ))}
        </div>

        <div className={`mt-6 grid grid-cols-1 gap-4 sm:gap-5 ${gridCols}`}>
          {filtered.map((p) => (
            <article
              key={p.id}
              className="ml-tarjeta flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800"
            >
              <TireThumb
                brand={p.marca}
                foto={p.foto}
                badge={p.categoria}
                badgeColor={colorCategoria[p.categoria]}
                className="h-32 w-full"
              />
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-bold tracking-wide text-amber-500 dark:text-amber-400">{p.marca.toUpperCase()}</p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{p.nombre}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {p.medidas} · {p.tipoVehiculo || 'Uso general'} · {p.codigo}
                </p>
                {p.descripcion && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{p.descripcion}</p>
                )}

                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Precio orientativo
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{p.rangoPrecio}</p>
                </div>

                {/* Cantidad y agregar al carro, sin abrir otra ventana */}
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(p.id, cantidadDe(p.id) - 1)}
                      disabled={cantidadDe(p.id) <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      aria-label={`Una llanta menos de ${p.nombre}`}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      inputMode="numeric"
                      value={cantidadDe(p.id)}
                      onChange={(e) => cambiarCantidad(p.id, soloDigitos(e.target.value))}
                      aria-label={`Cantidad de ${p.nombre}`}
                      className={`${INPUT} ${BORDER_OK} !w-12 !px-1 !py-1.5 text-center`}
                    />
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(p.id, cantidadDe(p.id) + 1)}
                      disabled={cantidadDe(p.id) >= CANTIDAD_MAXIMA}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                      aria-label={`Una llanta más de ${p.nombre}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                      added === p.id ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
                    }`}
                  >
                    {added === p.id ? (
                      <>
                        <Check size={14} /> Agregado
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={14} /> Agregar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!productos.cargando && filtered.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-400 dark:text-slate-500">
            {catalogo.length === 0 ? 'Todavía no hay llantas en el catálogo.' : 'Ningún producto coincide con la búsqueda.'}
          </p>
        )}
      </div>

      {/* Columna derecha: el carro de cotización. Se desplaza por su cuenta,
          así que el catálogo no se mueve mientras el cursor está encima. */}
      {carroAbierto && (
        <aside className="order-first mb-8 lg:sticky lg:top-24 lg:order-none lg:mb-0 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <PedidoPanel onClose={() => setCarroAbierto(false)} />
        </aside>
      )}
    </div>
  );
}
