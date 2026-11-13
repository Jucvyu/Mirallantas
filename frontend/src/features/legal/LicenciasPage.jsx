import Footer from '../../components/base/Footer';
import PublicNavbar from '../../components/layout/PublicNavbar';
import LicenciasContenido from './LicenciasContenido';

/**
 * Página pública de licencias (/licencias). Se llega desde el menú de la
 * página de inicio y desde el pie de página; no pide sesión.
 */
export default function LicenciasPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-brand-navy-950">
      <PublicNavbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-10">
        <LicenciasContenido />
      </main>
      <Footer />
    </div>
  );
}
