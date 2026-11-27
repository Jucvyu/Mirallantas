import { House } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Ruta de cada miga de pan del panel. "Inicio" lleva al dashboard y cada
 * módulo a su listado; la última miga es la página actual y no es enlace.
 */
const RUTAS = {
  Inicio: '/admin',
  Dashboard: '/admin',
  Licencias: '/admin/licencias',
  Roles: '/admin/roles',
  Usuarios: '/admin/usuarios',
  Proveedores: '/admin/proveedores',
  Terceros: '/admin/terceros',
  Productos: '/admin/productos',
  Categorías: '/admin/categorias',
  Marcas: '/admin/marcas',
  'Pedidos-Cotización': '/admin/pedidos-cotizacion',
  Ventas: '/admin/ventas',
  Compras: '/admin/compras',
  Reencauche: '/admin/reencauches',
  Revisiones: '/admin/reencauches',
  Órdenes: '/admin/ordenes-reencauche',
  Bandas: '/admin/bandas',
  Cartera: '/admin/creditos',
  'Solicitudes de crédito': '/admin/solicitudes-credito',
  Abonos: '/admin/abonos',
};

/**
 * Migas de pan. Cada miga es un texto (se busca su ruta en RUTAS) o un
 * objeto { texto, a } con la ruta explícita.
 */
export default function PageHeader({ crumbs }) {
  return (
    <nav aria-label="Ruta" className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      <Link to="/admin" aria-label="Ir al dashboard" className="hover:text-amber-500">
        <House size={13} />
      </Link>
      {crumbs.map((crumb, i) => {
        const texto = typeof crumb === 'string' ? crumb : crumb.texto;
        const ruta = typeof crumb === 'string' ? RUTAS[crumb] : crumb.a;
        const ultima = i === crumbs.length - 1;
        return (
          <span key={`${texto}-${i}`} className="flex items-center gap-1.5">
            <span>›</span>
            {ultima || !ruta ? (
              <span
                aria-current={ultima ? 'page' : undefined}
                className={ultima ? 'font-medium text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}
              >
                {texto}
              </span>
            ) : (
              <Link to={ruta} className="text-slate-400 hover:text-amber-500 hover:underline dark:text-slate-500 dark:hover:text-amber-400">
                {texto}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
