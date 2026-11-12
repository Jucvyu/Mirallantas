import Footer from '../../components/base/Footer';
import PublicNavbar from '../../components/layout/PublicNavbar';
import { useRecurso } from '../../hooks/useRecurso';
import { catalogoPublicoService } from '../../services';
import CatalogoListado from '../shared/CatalogoListado';

/**
 * Catálogo público (/catalogo), al que se llega desde el menú del landing.
 *
 * Usa el mismo listado que el portal con los datos reales de la API
 * (/api/catalogo: solo productos activos y datos públicos, sin precios).
 * Cada tarjeta abre el detalle del producto; desde ahí, para cotizar, se
 * inicia sesión y se vuelve al mismo producto en el portal.
 */
export default function CatalogoPublicoPage() {
  const productos = useRecurso(catalogoPublicoService);
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
          base="/catalogo"
          columnas="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        />
      </main>
      <Footer />
    </div>
  );
}
