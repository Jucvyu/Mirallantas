import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';

/**
 * Botón del carro de cotización en la barra superior del portal (arriba a
 * la derecha, junto a las notificaciones). La barra queda fija al bajar,
 * así que el carro siempre está a la vista sin tapar el contenido. Lleva a
 * la página del carro (/portal/carro) y muestra cuántas llantas lleva;
 * cuando se agrega algo, el contador da un pequeño salto para que se note.
 */
export default function BotonCarro() {
  const cart = useCart();
  const [salto, setSalto] = useState(false);
  const anterior = useRef(cart.unidades);

  useEffect(() => {
    const subio = cart.unidades > anterior.current;
    anterior.current = cart.unidades;
    if (!subio) return undefined;
    setSalto(true);
    const t = setTimeout(() => setSalto(false), 450);
    return () => clearTimeout(t);
  }, [cart.unidades]);

  const etiqueta =
    cart.unidades > 0
      ? `Mi carro de cotización: ${cart.unidades} ${cart.unidades === 1 ? 'llanta' : 'llantas'}`
      : 'Mi carro de cotización (vacío)';

  return (
    <NavLink
      to="/portal/carro"
      aria-label={etiqueta}
      title={etiqueta}
      className={({ isActive }) =>
        `relative flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          isActive || cart.unidades > 0
            ? 'border-amber-400 bg-amber-400/10 text-amber-700 dark:text-amber-300'
            : 'border-slate-200 text-slate-500 hover:text-amber-500 dark:border-white/10 dark:text-slate-300'
        }`
      }
    >
      <ShoppingCart size={15} aria-hidden="true" />
      <span className="hidden sm:inline">Mi carro</span>
      {cart.unidades > 0 && (
        <span
          aria-hidden="true"
          className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-slate-900 transition-transform duration-300 ease-out motion-reduce:transition-none ${
            salto ? 'scale-125' : 'scale-100'
          }`}
        >
          {cart.unidades > 99 ? '99+' : cart.unidades}
        </span>
      )}
    </NavLink>
  );
}
