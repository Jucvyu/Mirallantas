import { ArrowRight, LayoutGrid } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from '../base/Logo';
import ThemeToggle from '../base/ThemeToggle';

// Secciones de la página de inicio. Empiezan por "/" para que también
// funcionen desde el login (llevan a la página de inicio y bajan a la sección).
const LINKS = [
  { href: '/#productos', label: 'Productos' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#nosotros', label: 'Nosotros' },
  { href: '/#contacto', label: 'Contacto' },
];

/** Menú de la página de inicio, del catálogo público y del login. */
export default function PublicNavbar() {
  // En el login no hace falta el botón "Acceder": ya estás ahí
  const { pathname } = useLocation();
  const enLogin = pathname === '/login';

  return (
    <header className="sticky top-0 z-10 ml-glass border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-10">
        <Link to="/">
          <Logo size="sm" initials="ML" suffix="ERP" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* El catálogo se consulta sin iniciar sesión (también en celular,
              donde queda solo el icono para que la barra quepa en 360 px) */}
          <NavLink
            to="/catalogo"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors sm:px-3 ${
                isActive
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`
            }
          >
            <LayoutGrid size={15} aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Catálogo</span>
          </NavLink>
          <ThemeToggle />
          {!enLogin && (
            <Link
              to="/login"
              className="ml-pulsable inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 sm:px-4"
            >
              Acceder <ArrowRight size={15} aria-hidden="true" className="hidden sm:block" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
