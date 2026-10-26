import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AvisoError from '../base/AvisoError';
import FormModal from '../base/FormModal';
import { tiposDocumento } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { CartProvider } from '../../context/CartContext';
import { CreditoProvider } from '../../context/CreditoContext';
import { PortalProvider, usePortal } from '../../context/PortalContext';
import ClientNavbar from './ClientNavbar';
import { DosFactoresModal } from '../../features/auth/DosFactores';
import { AYUDA_PASSWORD, CAMPO_PASSWORD_ACTUAL, validarPerfil } from '../../features/auth/reglasClave';

// -------------------------------------------------------------------------
// Perfil del cliente
// Mismos campos que el modal del administrador, recortados a lo que un
// cliente puede tocar: sus datos de usuario más la dirección, que vive en
// su ficha de cliente.
// -------------------------------------------------------------------------
const perfilSections = [
  {
    title: 'Foto de perfil',
    fields: [{ key: 'foto', label: 'Foto', type: 'avatar', span: 2 }],
  },
  {
    title: 'Datos personales',
    // Orden de identificación del portal: tipo y número de documento,
    // nombre completo y dirección
    fields: [
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: tiposDocumento },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'documento', required: true },
      { key: 'nombre', label: 'Nombre completo', nombrePersona: true, required: true, span: 2 },
      { key: 'direccion', label: 'Dirección', span: 2, placeholder: 'Calle 50 #45-12, Medellín' },
      { key: 'correo', label: 'Correo electrónico', type: 'email', required: true },
      { key: 'telefono', label: 'Teléfono', type: 'tel' },
    ],
  },
  {
    title: 'Acceso',
    fields: [
      {
        key: 'password',
        label: 'Nueva contraseña',
        type: 'password',
        span: 2,
        placeholder: 'Déjala vacía para no cambiarla',
        hint: AYUDA_PASSWORD,
      },
      CAMPO_PASSWORD_ACTUAL,
    ],
  },
];

/**
 * Portal del cliente.
 *
 * Proveedores de datos, de afuera hacia adentro:
 *   CartProvider    la cotización que el cliente va armando (en memoria)
 *   PortalProvider  sus datos guardados en la API (cotizaciones, cartera…)
 *   CreditoProvider su saldo usable, calculado con sus créditos
 */
export default function ClientLayout() {
  return (
    <CartProvider>
      <PortalProvider>
        <CarteraDelPortal>
          <ContenidoPortal />
        </CarteraDelPortal>
      </PortalProvider>
    </CartProvider>
  );
}

/** Pasa los créditos que llegaron de la API al cálculo del saldo usable. */
function CarteraDelPortal({ children }) {
  const { creditos } = usePortal();
  return (
    <CreditoProvider creditos={creditos}>
      {children}
    </CreditoProvider>
  );
}

function ContenidoPortal() {
  const { usuario: profile, actualizarPerfil } = useAuth();
  const { error, recargar } = usePortal();
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [seguridadOpen, setSeguridadOpen] = useState(false);

  /** Guarda el perfil (con el servicio de sesión) y refresca el portal. */
  const guardarPerfil = async (values) => {
    await actualizarPerfil(values);
    await recargar();
  };

  return (
    <div className="ml-ambiente flex min-h-screen flex-col bg-slate-50 dark:bg-brand-navy-900">
      <ClientNavbar
        profile={profile}
        onEditarPerfil={() => setPerfilOpen(true)}
        onSeguridad={() => setSeguridadOpen(true)}
      />
      <main className="ml-vista mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <AvisoError mensaje={error} className="mb-5" />
        {/* La pantalla se descarga al abrirla: mientras tanto el menú sigue en su sitio */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
      </main>
      <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-400 dark:border-white/10 dark:text-slate-500">
        © {new Date().getFullYear()} MiraLlantas ERP · Portal de cliente
      </footer>

      {perfilOpen && (
        <FormModal
          mode="edit"
          title="Mi perfil"
          subtitle="Actualiza tus datos de contacto y de facturación."
          sections={perfilSections}
          initialValues={profile}
          validate={validarPerfil(profile)}
          submitLabel="Guardar perfil"
          onSubmit={guardarPerfil}
          onClose={() => setPerfilOpen(false)}
        />
      )}

      {seguridadOpen && <DosFactoresModal onClose={() => setSeguridadOpen(false)} />}
    </div>
  );
}
