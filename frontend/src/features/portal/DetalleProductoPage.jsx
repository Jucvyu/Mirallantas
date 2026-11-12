import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import { BORDER_OK, INPUT, soloDigitos } from '../../components/base/formStyles';
import { maximoDe, useCart } from '../../context/CartContext';
import { useMedidasDeProducto } from '../../hooks/useMedidasDeProducto';
import { productosService } from '../../services';
import DetalleProducto from '../shared/DetalleProducto';

const acotar = (n, maximo) => Math.min(maximo, Math.max(1, Number(n) || 1));

/**
 * Detalle de un producto en el portal del cliente: se elige posición y
 * medida y esa medida (la referencia) va al carro de cotización. La llanta
 * reencauchada es una sola unidad: se agrega una vez, sin elegir cantidad.
 */
export default function DetalleProductoPage() {
  const { modeloId, productoId } = useParams();
  const { referencias, cargando, error } = useMedidasDeProducto(productosService, { modeloId, productoId });
  const cart = useCart();
  const [cantidad, setCantidad] = useState(1);
  const [agregada, setAgregada] = useState(null);

  const accion = (r) => {
    const maximo = maximoDe(r);
    const enCarro = cart.productos.find((x) => x.id === r.id);
    const verCarro = (
      <Link to="/portal/catalogo" state={{ abrirCarro: true }} className="font-bold text-amber-700 hover:underline dark:text-amber-400">
        Ver mi carro
      </Link>
    );

    // Llanta reencauchada: una sola unidad
    if (r.reencauchada) {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
              1 unidad · única
            </span>
            <button
              type="button"
              onClick={() => cart.addProducto(r, 1)}
              disabled={Boolean(enCarro)}
              className="flex h-11 min-w-[12rem] flex-1 items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:bg-emerald-500 disabled:text-white"
            >
              {enCarro ? <Check size={16} /> : <ShoppingCart size={16} />}
              {enCarro ? 'Ya está en tu carro' : 'Agregar al carro de cotización'}
            </button>
          </div>
          {enCarro && <p className="text-sm text-slate-600 dark:text-slate-300">Está apartada en tu carro. {verCarro}</p>}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCantidad((c) => acotar(c - 1, maximo))}
              disabled={cantidad <= 1}
              aria-label="Una llanta menos"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Minus size={15} />
            </button>
            <input
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(acotar(soloDigitos(e.target.value), maximo))}
              aria-label="Cantidad de llantas"
              className={`${INPUT} ${BORDER_OK} !h-11 !w-16 text-center text-base`}
            />
            <button
              type="button"
              onClick={() => setCantidad((c) => acotar(c + 1, maximo))}
              disabled={cantidad >= maximo}
              aria-label="Una llanta más"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Plus size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              cart.addProducto(r, cantidad);
              setAgregada(r.id);
              setCantidad(1);
            }}
            className={`flex h-11 min-w-[12rem] flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors ${
              agregada === r.id ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
            }`}
          >
            {agregada === r.id ? <Check size={16} /> : <ShoppingCart size={16} />}
            {agregada === r.id ? 'Agregada al carro' : 'Agregar al carro de cotización'}
          </button>
        </div>
        {enCarro && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tienes {enCarro.cantidad} de esta medida en tu carro. {verCarro}
          </p>
        )}
      </div>
    );
  };

  return (
    <DetalleProducto
      referencias={referencias}
      cargando={cargando}
      error={error}
      volver={{ a: '/portal/catalogo', texto: 'Catálogo' }}
      accion={accion}
    />
  );
}
