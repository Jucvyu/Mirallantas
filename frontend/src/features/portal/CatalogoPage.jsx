import { useMemo } from 'react';
import { useRecurso } from '../../hooks/useRecurso';
import { productosService } from '../../services';
import CatalogoListado from '../shared/CatalogoListado';

/**
 * Catálogo de llantas del portal. Sin precios ni stock: cada tarjeta abre
 * el detalle del producto, donde el cliente elige posición, medida y
 * cantidad y la agrega a su carro de cotización. El carro tiene su propia
 * página (/portal/carro) y se abre desde el botón de la barra superior,
 * arriba a la derecha. La llanta reencauchada, unidad única con precio fijo, tiene su
 * propia página. El precio se confirma después en la cotización formal.
 */
export default function CatalogoPage() {
  // A un cliente la API solo le envía los productos activos; si mira el
  // personal, se filtran aquí.
  const productos = useRecurso(productosService);
  const catalogo = useMemo(() => productos.filas.filter((p) => p.disponible ?? p.activo), [productos.filas]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Catálogo de Llantas</h1>
      <CatalogoListado
        productos={catalogo}
        cargando={productos.cargando}
        error={productos.error}
        base="/portal/catalogo"
        columnas="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      />
    </div>
  );
}
