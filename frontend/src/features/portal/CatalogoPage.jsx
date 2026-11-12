import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useRecurso } from '../../hooks/useRecurso';
import { productosService } from '../../services';
import CatalogoListado from '../shared/CatalogoListado';
import PedidoPanel from './PedidoPanel';

/**
 * Catálogo de llantas del portal. Sin precios ni stock: cada tarjeta abre
 * el detalle del producto, donde el cliente elige posición, medida y
 * cantidad y la agrega a su carro de cotización (que se abre aquí, a la
 * derecha). La llanta reencauchada, unidad única con precio fijo, tiene su
 * propia página. El precio se confirma después en la cotización formal.
 */
export default function CatalogoPage() {
  // Desde el detalle de un producto, "Ver mi carro" llega con el carro abierto
  const { state } = useLocation();
  const [carroAbierto, setCarroAbierto] = useState(Boolean(state?.abrirCarro));
  const cart = useCart();

  // A un cliente la API solo le envía los productos activos; si mira el
  // personal, se filtran aquí.
  const productos = useRecurso(productosService);
  const catalogo = useMemo(() => productos.filas.filter((p) => p.disponible ?? p.activo), [productos.filas]);

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
          base="/portal/catalogo"
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
