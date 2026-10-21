import { LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '../../components/base/Footer';
import PublicNavbar from '../../components/layout/PublicNavbar';
import { useAuth } from '../../context/AuthContext';
import { useRecurso } from '../../hooks/useRecurso';
import { catalogoPublicoService } from '../../services';
import { puedeAbrir } from '../../permisos';
import CatalogoListado from '../shared/CatalogoListado';

/**
 * Catálogo público (/catalogo), al que se llega desde el menú del landing.
 *
 * Usa el mismo listado que el portal con los datos reales de la API
 * (/api/catalogo: solo productos activos y datos públicos, sin precios).
 * Para pedir una cotización hay que iniciar sesión: el botón lleva al
 * login y, al entrar, al catálogo del portal con el carro de cotización.
 */
export default function CatalogoPublicoPage() {
  const productos = useRecurso(catalogoPublicoService);
  const { usuario } = useAuth();
  // Con sesión y permiso del catálogo del portal, se va directo allá
  const destino = usuario && puedeAbrir(usuario, '/portal/catalogo') ? '/portal/catalogo' : '/login';

  const accion = () => (
    <Link
      to={destino}
      state={destino === '/login' ? { desde: '/portal/catalogo' } : undefined}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400 py-2 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-400/10 dark:text-amber-400"
    >
      <LogIn size={14} /> {destino === '/login' ? 'Inicia sesión para cotizar' : 'Cotizar en mi portal'}
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-brand-navy-950">
      <PublicNavbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-10">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">Catálogo de llantas</h1>
        <p className="mb-6 mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Consulta las llantas que manejamos. Para conocer el precio, inicia sesión y envía tu solicitud de cotización.
        </p>
        <CatalogoListado
          productos={productos.filas}
          cargando={productos.cargando}
          error={productos.error}
          accion={accion}
          columnas="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        />
      </main>
      <Footer />
    </div>
  );
}
