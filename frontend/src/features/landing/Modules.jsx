import {
  CreditCard,
  FileText,
  LayoutGrid,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const MODULES = [
  { icon: LayoutGrid, title: 'Dashboard', sub: 'KPIs en tiempo real', tint: 'text-amber-400 bg-amber-400/10' },
  { icon: Package, title: 'Productos', sub: 'Inventario y catálogo', tint: 'text-blue-400 bg-blue-400/10' },
  { icon: FileText, title: 'Pedidos', sub: 'Ventas y cotizaciones', tint: 'text-emerald-400 bg-emerald-400/10' },
  { icon: ShoppingCart, title: 'Compras', sub: 'Órdenes a proveedores', tint: 'text-violet-400 bg-violet-400/10' },
  { icon: Wrench, title: 'Reencauche', sub: 'Gestión completa', tint: 'text-amber-400 bg-amber-400/10' },
  { icon: Truck, title: 'Entregas', sub: 'Seguimiento logístico', tint: 'text-red-400 bg-red-400/10' },
  { icon: CreditCard, title: 'Créditos', sub: 'Cupos y abonos', tint: 'text-cyan-400 bg-cyan-400/10' },
  { icon: Users, title: 'Usuarios', sub: 'Roles y permisos', tint: 'text-pink-400 bg-pink-400/10' },
];

export default function Modules() {
  return (
    <section id="modulos" className="border-t border-slate-200 bg-slate-50 py-16 dark:border-white/10 dark:bg-brand-navy-900">
      <div className="mx-auto max-w-6xl px-6 text-center sm:px-10">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Módulos del sistema</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Todo lo que necesitas para gestionar tu negocio de llantas
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ icon: Icon, title, sub, tint }) => (
            <Link
              key={title}
              to="/login"
              className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-brand-navy-800"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
                <Icon size={18} strokeWidth={2.25} />
              </span>
              <p className="mt-3.5 text-sm font-bold text-slate-900 dark:text-white">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
