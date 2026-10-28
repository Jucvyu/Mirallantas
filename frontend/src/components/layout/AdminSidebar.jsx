import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Banknote,
  Building2,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  FileText,
  HandCoins,
  LayoutGrid,
  LogOut,
  Package,
  PanelLeft,
  Receipt,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Stamp,
  Tag,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import Logo from '../base/Logo';
import Tooltip from '../base/Tooltip';
import logoOficial from '../../assets/logo-mirallantas.png';
import { useAuth } from '../../context/AuthContext';
import { useAvisosPorModulo } from '../../hooks/useAvisosPorModulo';
import { MODULOS_PORTAL, permisoDeRuta } from '../../permisos';

// El Dashboard queda fuera del acordeón: es el punto de entrada y debe
// estar siempre visible.
const DASHBOARD = { to: '/admin', label: 'Dashboard', icon: LayoutGrid, end: true };

const SECTIONS = [
  {
    label: 'CONFIGURACIÓN',
    items: [
      { to: '/admin/roles', label: 'Roles y permisos', icon: Shield },
      { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
    ],
  },
  {
    label: 'CATÁLOGO',
    items: [
      { to: '/admin/productos', label: 'Productos', icon: Package },
      { to: '/admin/categorias', label: 'Categorías', icon: Tag },
      { to: '/admin/marcas', label: 'Marcas', icon: Stamp },
    ],
  },
  {
    label: 'CONTACTOS',
    items: [
      { to: '/admin/clientes', label: 'Clientes', icon: UserRound },
      { to: '/admin/proveedores', label: 'Proveedores', icon: Building2 },
      { to: '/admin/terceros', label: 'Terceros', icon: Building2 },
    ],
  },
  {
    label: 'OPERACIÓN',
    items: [
      { to: '/admin/pedidos-cotizacion', label: 'Pedidos-Cotización', icon: FileText },
      { to: '/admin/ventas', label: 'Ventas', icon: Receipt },
      { to: '/admin/compras', label: 'Compras', icon: ShoppingCart },
      { to: '/admin/solicitudes-servicio', label: 'Solicitudes de servicio', icon: Wrench },
    ],
  },
  {
    label: 'CARTERA',
    items: [
      { to: '/admin/creditos', label: 'Cartera', icon: CreditCard },
      { to: '/admin/solicitudes-credito', label: 'Solicitudes de crédito', icon: HandCoins },
      { to: '/admin/abonos', label: 'Abonos', icon: Banknote },
    ],
  },
];

/**
 * Sidebar del admin.
 *
 * - En escritorio (lg+) queda fijo y se puede colapsar a solo iconos.
 * - Por debajo de lg se comporta como cajón: se abre desde el botón de
 *   menú del topbar (`mobileOpen`) sobre un velo oscuro.
 * - Solo muestra los módulos que el rol del usuario tiene permitidos; una
 *   sección sin ningún módulo permitido no aparece.
 */
/** Preferencia del menú automático, guardada en este navegador. */
const CLAVE_AUTOMATICO = 'mirallantas-menu-automatico';
const leerAutomatico = () => {
  try {
    return localStorage.getItem(CLAVE_AUTOMATICO) === 'si';
  } catch {
    return false;
  }
};

/** Al quitar el mouse, espera un instante antes de plegarse (evita parpadeos). */
const ESPERA_PLEGAR_MS = 250;

export default function AdminSidebar({ profile, mobileOpen = false, onCloseMobile }) {
  // Plegado a mano (botón de la flecha), cuando el modo automático está apagado
  const [plegadoManual, setPlegadoManual] = useState(false);
  // Modo automático: se pliega al quitar el mouse y se despliega al pasarlo
  const [automatico, setAutomatico] = useState(leerAutomatico);
  const [encima, setEncima] = useState(false);
  const temporizador = useRef(null);
  // En el celular (cajón abierto) siempre se ve completo
  const collapsed = automatico ? !encima && !mobileOpen : plegadoManual;

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const alEntrar = () => {
    clearTimeout(temporizador.current);
    setEncima(true);
  };
  const alSalir = () => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEncima(false), ESPERA_PLEGAR_MS);
  };

  const alternarAutomatico = () => {
    const nuevo = !automatico;
    setAutomatico(nuevo);
    try {
      localStorage.setItem(CLAVE_AUTOMATICO, nuevo ? 'si' : 'no');
    } catch {
      // Sin almacenamiento: dura lo que dure la pestaña
    }
  };
  // Acordeón: por defecto todo desplegado; aquí solo se anotan las
  // secciones que el usuario decidió ocultar.
  const [cerradas, setCerradas] = useState({});
  // cerrarSesion invalida el token en la API y lleva a la página de inicio
  const { tienePermiso, cerrarSesion } = useAuth();
  // Avisos nuevos por módulo, para las burbujas del menú
  const avisosPorRuta = useAvisosPorModulo();

  // Cada sección se queda solo con los módulos que el rol puede abrir
  const secciones = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((item) => tienePermiso(permisoDeRuta(item.to))),
  })).filter((s) => s.items.length > 0);


  const alternarSeccion = (label) => setCerradas((prev) => ({ ...prev, [label]: !prev[label] }));
  const iniciales = profile.nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <>
      {/* Velo del cajón en móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          role="presentation"
        />
      )}

      <aside
        onMouseEnter={automatico ? alEntrar : undefined}
        onMouseLeave={automatico ? alSalir : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col ml-glass-oscuro transition-all duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-[76px]' : 'w-[220px]'}`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          {collapsed ? (
            <img
              src={logoOficial}
              alt="Logo de Mirallantas"
              width="256"
              height="262"
              className="ml-logo h-9 w-9 shrink-0 rounded-[10px] bg-[#F0AC25] object-contain"
            />
          ) : (
            <Logo size="sm" tono="oscuro" />
          )}
          {!collapsed && (
            <>
              <span className="ml-auto mr-1.5 hidden lg:inline-flex">
                <Tooltip texto={automatico ? 'Menú automático: activado' : 'Menú automático: se oculta al quitar el mouse'}>
                  <button
                    type="button"
                    onClick={alternarAutomatico}
                    aria-pressed={automatico}
                    aria-label="Menú automático"
                    className={`rounded-md p-1 transition-colors ${
                      automatico ? 'bg-amber-400/15 text-amber-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <PanelLeft size={15} />
                  </button>
                </Tooltip>
              </span>
              {!automatico && (
                <button
                  onClick={() => setPlegadoManual(true)}
                  className="hidden text-slate-500 hover:text-slate-300 lg:block"
                  aria-label="Colapsar menú"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <button
                onClick={onCloseMobile}
                className="text-slate-500 hover:text-slate-300 lg:hidden"
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>

        {collapsed && !automatico && (
          <button
            onClick={() => setPlegadoManual(false)}
            className="mx-auto mb-2 text-slate-500 hover:text-slate-300"
            aria-label="Expandir menú"
          >
            <ChevronLeft size={16} className="rotate-180" />
          </button>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {/* Dashboard: fuera del acordeón, si el rol lo tiene permitido */}
          {tienePermiso('Dashboard') && (
          <NavLink
            to={DASHBOARD.to}
            end={DASHBOARD.end}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `mb-4 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-400/10 text-amber-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
            title={collapsed ? DASHBOARD.label : undefined}
          >
            <DASHBOARD.icon size={16} className="shrink-0" />
            {!collapsed && <span className="truncate">{DASHBOARD.label}</span>}
          </NavLink>
          )}

          {secciones.map((section) => {
            // Con el sidebar en modo icono no hay títulos que plegar, así
            // que el acordeón solo aplica cuando está expandido.
            const abierta = collapsed || !cerradas[section.label];
            return (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => alternarSeccion(section.label)}
                  aria-expanded={abierta}
                  aria-label={`${abierta ? 'Ocultar' : 'Mostrar'} ${section.label}`}
                  className="mb-1.5 flex w-full items-center justify-between gap-2 rounded px-2.5 py-0.5 text-slate-600 transition-colors hover:bg-white/5 hover:text-slate-300"
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider">
                    {section.label}
                    {/* Sección plegada con avisos: un punto para no perderlos de vista */}
                    {!abierta && section.items.some(({ to }) => avisosPorRuta[to] > 0) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Hay avisos nuevos" />
                    )}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`shrink-0 transition-transform duration-200 ${abierta ? '' : '-rotate-90'}`}
                  />
                </button>
              )}
              {/* El plegado se anima con grid-rows: no necesita medir alturas */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  abierta ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
              <ul className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, end }) => {
                  const avisos = avisosPorRuta[to] ?? 0;
                  return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`
                      }
                      title={collapsed ? label : undefined}
                    >
                      <span className="relative shrink-0">
                        <Icon size={16} />
                        {/* Burbuja de avisos nuevos (como en WhatsApp); sin avisos no aparece */}
                        {avisos > 0 && collapsed && (
                          <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-brand-navy-900" />
                        )}
                      </span>
                      {!collapsed && <span className="truncate">{label}</span>}
                      {avisos > 0 && !collapsed && (
                        <span
                          className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                          aria-label={`${avisos} avisos nuevos`}
                        >
                          {avisos > 9 ? '9+' : avisos}
                        </span>
                      )}
                    </NavLink>
                  </li>
                  );
                })}
              </ul>
                </div>
              </div>
            </div>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
            {profile.foto ? (
              <img src={profile.foto} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">
                {iniciales}
              </span>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{profile.nombre}</p>
                <p className="text-xs text-slate-500">{profile.rol}</p>
              </div>
            )}
          </div>
          {/* Solo si el rol tiene alguna pantalla de la vista de cliente */}
          {MODULOS_PORTAL.some((m) => tienePermiso(m.permiso)) && (
            <NavLink
              to="/portal"
              onClick={onCloseMobile}
              title={collapsed ? 'Portal del cliente' : undefined}
              className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-amber-400/90 transition-colors hover:bg-amber-400/10 hover:text-amber-400"
            >
              <ShoppingBag size={15} className="shrink-0" />
              {!collapsed && <span className="truncate">Portal del cliente</span>}
            </NavLink>
          )}

          <button
            type="button"
            onClick={() => cerrarSesion()}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <LogOut size={15} />
            {!collapsed && 'Salir'}
          </button>
        </div>
      </aside>
    </>
  );
}
