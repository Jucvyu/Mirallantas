import { LogOut, Menu } from 'lucide-react';
import ThemeToggle from '../base/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { avisosPersonalService } from '../../services';
import NotificacionesMenu from './NotificacionesMenu';
import PerfilMenu from './PerfilMenu';

export default function AdminTopbar({ title, profile, onOpenMenu, onEditarPerfil, onSeguridad }) {
  // cerrarSesion invalida el token en la API y lleva a la página de inicio
  const { cerrarSesion, tienePermiso } = useAuth();

  // Detalle inicial que se ve en el desplegable del avatar
  const campos = [
    { label: 'Documento', value: `${profile.tipoDocumento ?? ''} ${profile.numeroDocumento ?? ''}`.trim() },
    { label: 'Correo', value: profile.correo },
    { label: 'Teléfono', value: profile.telefono },
    { label: 'Rol', value: profile.rol },
  ];

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-brand-navy-950/90 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
        <h2 className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <ThemeToggle />
        {/* Avisos de Pedidos-Cotización: solo para quien tiene ese módulo */}
        {tienePermiso('Pedidos-Cotización') && <NotificacionesMenu servicio={avisosPersonalService} />}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-white/10 sm:pl-4">
          <PerfilMenu profile={profile} campos={campos} onEditar={onEditarPerfil} onSeguridad={onSeguridad} />
          <button
            type="button"
            onClick={() => cerrarSesion()}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <LogOut size={13} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
