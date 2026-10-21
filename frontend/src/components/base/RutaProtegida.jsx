import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AccesoDenegadoPage from '../../features/auth/AccesoDenegadoPage';
import { DosFactoresObligatorio } from '../../features/auth/DosFactores';
import { pantallaInicial, veElPortal } from '../../permisos';
import Skeleton, { SkeletonFilas } from './Skeleton';

/** Silueta gris del panel mientras se comprueba la sesión guardada. */
function ComprobandoSesion() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-brand-navy-900">
      <aside className="hidden w-64 shrink-0 space-y-4 border-r border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800 lg:block">
        <Skeleton className="h-8 w-36" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </aside>
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800">
          <table className="w-full">
            <tbody>
              <SkeletonFilas filas={6} columnas={4} />
            </tbody>
          </table>
        </div>
      </main>
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
