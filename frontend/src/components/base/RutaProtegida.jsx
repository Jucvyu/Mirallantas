import { LoaderCircle } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AccesoDenegadoPage from '../../features/auth/AccesoDenegadoPage';
import { DosFactoresObligatorio } from '../../features/auth/DosFactores';
import { pantallaInicial, veElPortal } from '../../permisos';

/** Pantalla breve mientras se comprueba la sesión guardada. */
function ComprobandoSesion() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-sm text-slate-500 dark:bg-brand-navy-900 dark:text-slate-400">
      <LoaderCircle size={16} className="animate-spin" /> Comprobando tu sesión…
    </div>
  );
}

/**
 * Protege una zona de la app.
 *
 *   <RutaProtegida zona="admin"> … </RutaProtegida>
 *
 * - Sin sesión → al login (y al volver a entrar, regresa a donde iba).
 * - zona "admin": un cliente del portal no entra al panel; va a su portal.
 * - zona "portal": entra el cliente y el personal cuyo rol tenga alguna
 *   pantalla de la vista de cliente (Catálogo, Mis cotizaciones, Mi
 *   cartera); los demás vuelven a su pantalla inicial del panel.
 * - Un Administrador sin verificación en dos pasos no ve ninguna zona
 *   hasta activarla.
 *
 * Es solo una ayuda visual: quien de verdad protege los datos es la API,
 * que revisa el token y los permisos en cada petición.
 */
export default function RutaProtegida({ zona, children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <ComprobandoSesion />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (usuario.debeActivar2fa) return <DosFactoresObligatorio />;
  if (zona === 'admin' && usuario.clienteId) return <Navigate to="/portal" replace />;
  if (zona === 'portal' && !usuario.clienteId && !veElPortal(usuario)) {
    return <Navigate to={pantallaInicial(usuario)} replace />;
  }
  return children;
}

/**
 * Muestra la página solo si el rol tiene el permiso del módulo; si no,
 * muestra la pantalla de acceso denegado.
 *
 *   <ConPermiso modulo="Clientes"><ClientesPage /></ConPermiso>
 */
export function ConPermiso({ modulo, children }) {
  const { tienePermiso } = useAuth();
  return tienePermiso(modulo) ? children : <AccesoDenegadoPage />;
}
