import { useRecurso } from '../../hooks/useRecurso';
import { catalogoPublicoService } from '../../services';
import CatalogoListado from '../shared/CatalogoListado';
import Revelar from './Revelar';

/**
 * #productos · catálogo integrado en el landing.
 *
 * Usa el mismo servicio y el mismo listado que el catálogo público
 * (/api/catalogo: solo productos activos, sin precios), con búsqueda,
 * filtros, esqueletos y manejo de error. Muestra 8 llantas y "Ver más".
 * Cada tarjeta abre el detalle del producto, igual que en el catálogo
 * público.
 */
export default function Productos() {
  const productos = useRecurso(catalogoPublicoService);
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
            base="/catalogo"
            limite={8}
            columnas="sm:grid-cols-2 lg:grid-cols-4"
          />
        </Revelar>
      </div>
    </section>
  );
}
