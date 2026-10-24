import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import FormModal from '../base/FormModal';
import { tiposDocumento } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import { DosFactoresModal } from '../../features/auth/DosFactores';
import { AYUDA_PASSWORD, CAMPO_PASSWORD_ACTUAL, validarPerfil } from '../../features/auth/reglasClave';

const TITLES = {
  '/admin': 'Dashboard',
  '/admin/roles': 'Roles y permisos',
  '/admin/usuarios': 'Usuarios',
  '/admin/clientes': 'Clientes',
  '/admin/proveedores': 'Proveedores',
  '/admin/terceros': 'Terceros',
  '/admin/productos': 'Productos',
  '/admin/categorias': 'Categorías',
  '/admin/marcas': 'Marcas',
  '/admin/pedidos-cotizacion': 'Pedidos-Cotización',
  '/admin/ventas': 'Ventas',
  '/admin/compras': 'Compras',
  '/admin/solicitudes-servicio': 'Solicitudes de servicio',
  '/admin/creditos': 'Cartera',
  '/admin/solicitudes-credito': 'Solicitudes de crédito',
  '/admin/abonos': 'Abonos',
};

// Mismos campos que usa el formulario de Usuarios. El rol no aparece:
// nadie cambia su propio rol (lo hace otro administrador desde Usuarios).
const perfilSections = [
  {
    title: 'Foto de perfil',
    fields: [{ key: 'foto', label: 'Foto', type: 'avatar', span: 2 }],
  },
  {
    title: 'Datos personales',
    fields: [
      { key: 'nombre', label: 'Nombre completo', nombrePersona: true, required: true, span: 2 },
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: tiposDocumento },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'documento', required: true },
      { key: 'correo', label: 'Correo electrónico', type: 'email', required: true },
      { key: 'telefono', label: 'Teléfono', type: 'tel' },
    ],
  },
  {
    title: 'Acceso al sistema',
    fields: [
      { key: 'rol', label: 'Rol', only: 'view' },
      {
        key: 'password',
        label: 'Nueva contraseña',
        type: 'password',
        placeholder: 'Déjala vacía para no cambiarla',
        hint: AYUDA_PASSWORD,
        span: 2,
      },
      CAMPO_PASSWORD_ACTUAL,
    ],
  },
];

export default function AdminLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'Dashboard';

  const [menuOpen, setMenuOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [seguridadOpen, setSeguridadOpen] = useState(false);
  // El perfil es el del usuario que inició sesión
  const { usuario: profile, actualizarPerfil } = useAuth();

  return (
    <div className="ml-ambiente flex min-h-screen bg-slate-50 dark:bg-brand-navy-900">
      <AdminSidebar profile={profile} mobileOpen={menuOpen} onCloseMobile={() => setMenuOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AdminTopbar
          title={title}
          profile={profile}
          onOpenMenu={() => setMenuOpen(true)}
          onEditarPerfil={() => setPerfilOpen(true)}
          onSeguridad={() => setSeguridadOpen(true)}
        />
        {/* `key` fuerza la animación en cada cambio de módulo */}
        <main key={pathname} className="ml-vista flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {perfilOpen && (
        <FormModal
          mode="edit"
          title="Mi perfil"
          subtitle="Actualiza tus datos de contacto y de acceso."
          sections={perfilSections}
          initialValues={profile}
          validate={validarPerfil(profile)}
          submitLabel="Guardar perfil"
          // El servicio de sesión guarda el perfil (foto y contraseña solo si cambiaron)
          onSubmit={actualizarPerfil}
          onClose={() => setPerfilOpen(false)}
        />
      )}

      {seguridadOpen && <DosFactoresModal onClose={() => setSeguridadOpen(false)} />}
    </div>
  );
}
