import { useMemo, useState } from 'react';
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import { BORDER_OK, INPUT, soloDigitos } from '../../components/base/formStyles';
import { CANTIDAD_MAXIMA, useCart } from '../../context/CartContext';
import { useRecurso } from '../../hooks/useRecurso';
import { productosService } from '../../services';
import CatalogoListado from '../shared/CatalogoListado';
import PedidoPanel from './PedidoPanel';

/** Cantidad entre 1 y 999. */
const acotar = (n) => Math.min(CANTIDAD_MAXIMA, Math.max(1, Number(n) || 1));

/**
 * Catálogo de llantas del portal. Sin precios ni stock: el cliente elige la
 * cantidad en cada tarjeta y la agrega a su carro de cotización, que se ve
 * a la derecha. El precio se confirma después en la cotización formal.
 */
export default function CatalogoPage() {
  // Cantidad elegida en cada tarjeta (por defecto 1)
  const [cantidades, setCantidades] = useState({});
  const [added, setAdded] = useState(null);
  const [carroAbierto, setCarroAbierto] = useState(false);
  const cart = useCart();

  // A un cliente la API solo le envía los productos activos; si mira el
  // personal, se filtran aquí.
  const productos = useRecurso(productosService);
  const catalogo = useMemo(() => productos.filas.filter((p) => p.activo), [productos.filas]);

  const cantidadDe = (id) => cantidades[id] ?? 1;
  const cambiarCantidad = (id, valor) => setCantidades((c) => ({ ...c, [id]: acotar(valor) }));

  const agregar = (producto) => {
    cart.addProducto(producto, cantidadDe(producto.id));
    setCarroAbierto(true);
    setAdded(producto.id);
    setCantidades((c) => ({ ...c, [producto.id]: 1 }));
    setTimeout(() => setAdded((id) => (id === producto.id ? null : id)), 1400);
  };

  /** Pie de cada tarjeta: cantidad y "Agregar", sin abrir otra ventana. */
  const accion = (p) => (
    <div className="flex items-center gap-2">
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
  );

  return (
    <div className={carroAbierto ? 'flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6' : ''}>
      {/* Columna izquierda: el catálogo */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Catálogo de Llantas</h1>
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

        <CatalogoListado
          productos={catalogo}
          cargando={productos.cargando}
          error={productos.error}
          accion={accion}
          columnas={carroAbierto ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}
        />
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
