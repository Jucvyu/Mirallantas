import { useState } from 'react';
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import Logo from '../base/Logo';
import { useAuth } from '../../context/AuthContext';
import { usePortal } from '../../context/PortalContext';
import { permisoDeRuta, primerModuloAdmin } from '../../permisos';
import ThemeToggle from '../base/ThemeToggle';
import PerfilMenu from './PerfilMenu';
import NotificacionesMenu from './NotificacionesMenu';

const LINKS = [
  { to: '/portal', label: 'Inicio', end: true },
  { to: '/portal/catalogo', label: 'Catálogo' },
  { to: '/portal/pedidos', label: 'Mis Cotizaciones' },
  { to: '/portal/cartera', label: 'Mi Cartera' },
];

const linkClass = ({ isActive }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'border border-amber-400 text-amber-500 dark:text-amber-400'
      : 'border border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
  }`;

export default function ClientNavbar({ profile, onEditarPerfil, onSeguridad }) {
  const [open, setOpen] = useState(false);
  // cerrarSesion invalida el token en la API y lleva a la página de inicio
  const { usuario, cerrarSesion, tienePermiso } = useAuth();
  // El personal que mira el portal vuelve a su primer módulo del panel
  // (un cliente no tiene panel, así que no ve el botón)
  const panel = primerModuloAdmin(usuario);
  const { recargar } = usePortal();
  // Solo las pantallas que el rol tiene permitidas (Inicio no pide permiso)
  const links = LINKS.filter(({ to }) => !permisoDeRuta(to) || tienePermiso(permisoDeRuta(to)));

  // Detalle inicial que se ve en el desplegable del avatar
  const campos = [
    { label: 'Documento', value: `${profile.tipoDocumento ?? ''} ${profile.numeroDocumento ?? ''}`.trim() },
    { label: 'Correo', value: profile.correo },
    { label: 'Teléfono', value: profile.telefono },
    { label: 'Dirección', value: profile.direccion },
  ];

  return (
    <header className="sticky top-0 z-20 ml-glass border-b">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo size="sm" />

        {/* Navegación de escritorio */}
        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
          {links.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {panel && (
            <Link
              to={panel}
              title="Volver al panel administrativo"
              className="flex items-center gap-1.5 rounded-lg border border-amber-400 px-2.5 py-1.5 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-400/10 dark:text-amber-400"
            >
              <LayoutDashboard size={14} />
              <span className="hidden 2xl:inline">Panel administrativo</span>
            </Link>
          )}
          <ThemeToggle />
          {/* Avisos del asesor (pagos, abonos, créditos) */}
          {/* Si llega un aviso nuevo, se recargan los datos del portal */}
          <NotificacionesMenu onNuevas={recargar} />

          {/* La foto despliega el detalle del perfil, igual que en el admin */}
          <PerfilMenu profile={profile} campos={campos} onEditar={onEditarPerfil} onSeguridad={onSeguridad} />
          <button
            type="button"
            onClick={() => cerrarSesion()}
            className="hidden items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 sm:flex"
          >
            <LogOut size={13} /> Salir
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Navegación desplegable en móvil / tablet */}
      {open && (
        <nav className="border-t border-slate-900/5 px-4 pb-4 pt-2 dark:border-white/10 lg:hidden">
          <ul className="space-y-1">
            {links.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={(state) => `${linkClass(state)} block`}
                >
                  {label}
                </NavLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => cerrarSesion()}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                <LogOut size={14} /> Salir
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
