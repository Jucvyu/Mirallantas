import { Disc3 } from 'lucide-react';

const BRAND_GRADIENTS = {
  Michelin: 'from-blue-900 to-slate-900',
  Bridgestone: 'from-red-900 to-slate-900',
  Goodyear: 'from-amber-800 to-slate-900',
  Continental: 'from-emerald-900 to-slate-900',
};

/**
 * Miniatura de un producto: su foto si la tiene (la que se guardó en la
 * base de datos); si no, el ícono de llanta sobre el color de su marca.
 */
export default function TireThumb({ brand, foto, badge, badgeColor, className = '' }) {
  const gradient = BRAND_GRADIENTS[brand] ?? 'from-slate-700 to-slate-900';
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}>
      {foto ? (
        <img src={foto} alt={brand ? `Llanta ${brand}` : 'Producto'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Disc3 size={48} strokeWidth={1} className="text-white/25" />
      )}
      {badge && (
        // El color lo define la categoría desde la gestión del admin
        <span
          className="absolute right-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold tracking-wide text-white"
          style={{ backgroundColor: badgeColor ?? 'rgba(0,0,0,0.6)' }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
