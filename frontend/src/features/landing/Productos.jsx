import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRecurso } from '../../hooks/useRecurso';
import { puedeAbrir } from '../../permisos';
import { catalogoPublicoService } from '../../services';
import CatalogoListado from '../shared/CatalogoListado';
import Revelar from './Revelar';

/**
 * #productos · catálogo integrado en el landing.
 *
 * Usa el mismo servicio y el mismo listado que el catálogo público
 * (/api/catalogo: solo productos activos, sin precios), con búsqueda,
 * filtros, esqueletos y manejo de error. Muestra 8 llantas y "Ver más".
 * "Cotizar" lleva al portal (o al login si no hay sesión), igual que en
 * el catálogo público.
 */
export default function Productos() {
  const productos = useRecurso(catalogoPublicoService);
  const { usuario } = useAuth();
  const destino = usuario && puedeAbrir(usuario, '/portal/catalogo') ? '/portal/catalogo' : '/login';

  const accion = () => (
    <Link
      to={destino}
      state={destino === '/login' ? { desde: '/portal/catalogo' } : undefined}
      className="ml-pulsable flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-400 py-2.5 text-xs font-bold text-slate-900 hover:bg-amber-300"
    >
      <FileText size={14} aria-hidden="true" /> Cotizar
    </Link>
  );

  return (
    <section id="productos" aria-labelledby="productos-titulo" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <Revelar className="max-w-2xl">
          <h2 id="productos-titulo" className="text-3xl font-extrabold text-brand-blue dark:text-white sm:text-4xl">
            Nuestras llantas
          </h2>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
            Busca por medida, marca o tipo de vehículo. El precio te lo confirmamos en la cotización.
          </p>
        </Revelar>
        <Revelar className="mt-8" retraso={80}>
          <CatalogoListado
            productos={productos.filas}
            cargando={productos.cargando}
            error={productos.error}
            accion={accion}
            limite={8}
            columnas="sm:grid-cols-2 lg:grid-cols-4"
          />
        </Revelar>
      </div>
    </section>
  );
}
