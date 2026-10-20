import { useMemo, useState } from 'react';
import { Package, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Dropdown from '../../../components/base/Dropdown';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useRecurso } from '../../../hooks/useRecurso';
import { productosService } from '../../../services';

const CAMPO = `${INPUT} ${BORDER_OK} py-2`;

const pesos = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

// Los mismos filtros que el catálogo de llantas del portal del cliente
const FILTERS = [
  { key: 'marca', label: 'Marca' },
  { key: 'tipoVehiculo', label: 'Tipo vehículo' },
  { key: 'medidas', label: 'Medida' },
  { key: 'categoria', label: 'Categoría' },
];

/**
 * Todos los productos del sistema, con el mismo buscador y los mismos
 * filtros del catálogo de llantas del portal, para agregarlos al detalle
 * de la cotización sin salir del formulario.
 */
export default function SelectorProductosModal({ onAgregar, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState({});

  // Catálogo de la API. Un producto inactivo ya no se ofrece en cotizaciones nuevas
  const productos = useRecurso(productosService);
  const catalogo = useMemo(() => productos.filas.filter((p) => p.activo), [productos.filas]);

  const options = useMemo(
    () => FILTERS.map((f) => ({ ...f, options: [...new Set(catalogo.map((p) => p[f.key]).filter(Boolean))] })),
    [catalogo],
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogo.filter((p) => {
      const coincideTexto =
        !q || `${p.codigo} ${p.nombre} ${p.marca} ${p.medidas}`.toLowerCase().includes(q);
      const coincideFiltros = Object.entries(active).every(([k, v]) => !v?.length || v.includes(p[k]));
      return coincideTexto && coincideFiltros;
    });
  }, [catalogo, query, active]);

  return (
    <Modal
      title="Productos"
      subtitle="Elige del catálogo los productos que van al detalle de la cotización."
      icon={<Package size={17} />}
      size="lg"
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          Listo
        </button>
      )}
    >
      <div className="space-y-4">
        {/* ---- Búsqueda y filtros, iguales a los del catálogo ---- */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, código, marca o medida..."
              className={`${CAMPO} pl-9`}
            />
          </div>
          {options.map((f) => (
            <Dropdown
              key={f.key}
              label={f.label}
              multiple
              value={active[f.key] ?? []}
              options={f.options}
              onChange={(valores) => setActive((a) => ({ ...a, [f.key]: valores }))}
              icon={<SlidersHorizontal size={13} className="shrink-0 opacity-70" />}
            />
          ))}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {filtrados.length} de {catalogo.length} productos
        </p>

        {/* ---- Listado ---- */}
        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-brand-navy-900">
              <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5 text-right">Precio de lista</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {p.codigo} · {p.marca} · {p.medidas}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">{pesos(p.precioVenta)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onAgregar?.(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-300"
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                    {productos.cargando ? 'Cargando el catálogo…' : 'Ningún producto coincide con la búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
