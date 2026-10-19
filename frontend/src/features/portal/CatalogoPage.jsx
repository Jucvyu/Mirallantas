import { useMemo, useState } from 'react';
import { Check, Plus, Search, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import Dropdown from '../../components/base/Dropdown';
import TireThumb from '../../components/base/TireThumb';
import Modal from '../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../components/base/formStyles';
import { useCart } from '../../context/CartContext';
import { useRecurso } from '../../hooks/useRecurso';
import { categoriasService, productosService } from '../../services';
import PedidoPanel from './PedidoPanel';

const FILTERS = [
  { key: 'marca', label: 'Marca' },
  { key: 'tipoVehiculo', label: 'Tipo vehículo' },
  { key: 'medidas', label: 'Medida' },
  { key: 'categoria', label: 'Categoría' },
];


const pesos = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

export default function CatalogoPage() {
  const [query, setQuery] = useState('');
  // Cada filtro guarda un arreglo: se pueden marcar varias opciones
  const [active, setActive] = useState({});
  const [selected, setSelected] = useState(null);
  const [added, setAdded] = useState(null);
  // Al abrirlo, el catálogo se parte en dos: catálogo a la izquierda y la
  // cotización-pedido a la derecha.
  const [pedidoAbierto, setPedidoAbierto] = useState(false);
  const cart = useCart();

  // Catálogo del servicio de productos. Un producto inactivo ya no se
  // comercializa: a un cliente la API ni lo envía, y si mira el personal se
  // filtra aquí.
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
      const matchesQuery = !q || `${p.nombre} ${p.marca} ${p.medidas}`.toLowerCase().includes(q);
      const matchesFilters = Object.entries(active).every(([k, v]) => !v?.length || v.includes(p[k]));
      return matchesQuery && matchesFilters;
    });
  }, [catalogo, query, active]);

  const agregar = (producto) => {
    cart.addProducto(producto);
    setPedidoAbierto(true);
    setAdded(producto.id);
    setTimeout(() => setAdded((id) => (id === producto.id ? null : id)), 1400);
  };

  const gridCols = pedidoAbierto
    ? 'sm:grid-cols-2 xl:grid-cols-3'
    : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div
      className={
        pedidoAbierto ? 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6' : ''
      }
    >
      {/* Columna izquierda: el catálogo */}
      <div className="min-w-0">
        <div className="mb-6 flex">
          <button
            onClick={() => setPedidoAbierto((v) => !v)}
            aria-expanded={pedidoAbierto}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 transition-colors hover:bg-amber-300"
          >
            <Plus size={16} /> Crear cotización-pedido
            {cart.count > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-amber-400">
                {cart.count}
              </span>
            )}
          </button>
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Catálogo de Llantas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {productos.cargando ? 'Cargando el catálogo…' : `${filtered.length} de ${catalogo.length} productos`}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, marca o medida..."
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
            <div
              key={p.id}
              className="ml-tarjeta flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800"
            >
              <button onClick={() => setSelected(p)} className="text-left">
                <TireThumb
                  brand={p.marca}
                  foto={p.foto}
                  badge={p.categoria}
                  badgeColor={colorCategoria[p.categoria]}
                  className="h-32 w-full"
                />
              </button>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-bold tracking-wide text-amber-500 dark:text-amber-400">
                  {p.marca.toUpperCase()}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{p.nombre}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.medidas}</p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {pesos(p.precioVenta)}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      p.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                    }`}
                  >
                    {p.stock > 0 ? `${p.stock} disponibles` : 'Agotado'}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelected(p)}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() => agregar(p)}
                    // Sin unidades en inventario no se puede pedir
                    disabled={p.stock <= 0}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-400 dark:text-slate-500">
            Ningún producto coincide con la búsqueda.
          </p>
        )}
      </div>

      {/* Columna derecha: la cotización-pedido. Se desplaza por su cuenta,
          así que el catálogo no se mueve mientras el cursor está encima. */}
      {pedidoAbierto && (
        <aside className="order-first mb-8 lg:sticky lg:top-24 lg:order-none lg:mb-0 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <PedidoPanel onClose={() => setPedidoAbierto(false)} />
        </aside>
      )}

      {selected && (
        <Modal
          title={selected.nombre}
          subtitle={`${selected.marca} · ${selected.medidas}`}
          icon={<ShoppingCart size={16} />}
          size="lg"
          onClose={() => setSelected(null)}
          footer={(close) => (
            <button
              onClick={() => {
                agregar(selected);
                close();
              }}
              disabled={selected.stock <= 0}
              className="inline-flex items-center gap-2 rounded-lg disabled:cursor-not-allowed disabled:opacity-40 bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300"
            >
              <ShoppingCart size={16} /> Agregar a la cotización
            </button>
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            <TireThumb brand={selected.marca} foto={selected.foto} className="h-32 w-full shrink-0 rounded-lg sm:w-32" />
            <div>
              <p className="text-xs font-bold tracking-wide text-amber-500 dark:text-amber-400">
                {selected.marca.toUpperCase()}
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{selected.nombre}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{selected.medidas}</p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {pesos(selected.precioVenta)}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{selected.descripcion}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-white/10">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Código</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{selected.codigo}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Tipo de vehículo</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{selected.tipoVehiculo}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Categoría</dt>
              <dd className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                  style={{ backgroundColor: colorCategoria[selected.categoria] ?? '#94A3B8' }}
                />
                {selected.categoria}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Disponibilidad</dt>
              <dd
                className={`font-medium ${
                  selected.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                }`}
              >
                {selected.stock > 0 ? `${selected.stock} unidades` : 'Agotado'}
              </dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
