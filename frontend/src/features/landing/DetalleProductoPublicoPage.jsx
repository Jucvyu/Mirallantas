import { LogIn } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Footer from '../../components/base/Footer';
import PublicNavbar from '../../components/layout/PublicNavbar';
import { useAuth } from '../../context/AuthContext';
import { useMedidasDeProducto } from '../../hooks/useMedidasDeProducto';
import { puedeAbrir } from '../../permisos';
import { catalogoPublicoService } from '../../services';
import DetalleProducto from '../shared/DetalleProducto';

/**
 * Detalle público de un producto (/catalogo/:modeloId), sin sesión: se ven
 * las posiciones, las medidas y la ficha técnica. Para cotizar hay que
 * iniciar sesión; al entrar se vuelve a este mismo producto en el portal.
 */
export default function DetalleProductoPublicoPage() {
  const { modeloId } = useParams();
  const { referencias, cargando, error } = useMedidasDeProducto(catalogoPublicoService, modeloId);
  const { usuario } = useAuth();
  const enPortal = `/portal/catalogo/${modeloId}`;
  const conSesion = usuario && puedeAbrir(usuario, '/portal/catalogo');

  const accion = () => (
    <Link
      to={conSesion ? enPortal : '/login'}
      state={conSesion ? undefined : { desde: enPortal }}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 text-sm font-bold text-slate-900 hover:bg-amber-300"
    >
      <LogIn size={16} aria-hidden="true" /> {conSesion ? 'Cotizar en mi portal' : 'Inicia sesión para cotizar'}
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-brand-navy-950">
      <PublicNavbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-10">
        <DetalleProducto
          referencias={referencias}
          cargando={cargando}
          error={error}
          volver={{ a: '/catalogo', texto: 'Catálogo' }}
          accion={accion}
        />
      </main>
      <Footer />
    </div>
  );
}
