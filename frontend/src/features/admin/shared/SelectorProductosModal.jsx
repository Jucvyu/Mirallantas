import { useMemo, useState } from 'react';
import { Check, LoaderCircle, Package, Plus, Search, SlidersHorizontal } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Dropdown from '../../../components/base/Dropdown';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useRecurso } from '../../../hooks/useRecurso';
import { productosService } from '../../../services';

const CAMPO = `${INPUT} ${BORDER_OK} py-2`;

// Los mismos filtros que el catálogo de llantas del portal del cliente
const FILTERS = [
  { key: 'marca', label: 'Marca' },
  { key: 'tipoVehiculo', label: 'Tipo vehículo' },
  { key: 'medidas', label: 'Medida' },
  { key: 'categoria', label: 'Categoría' },
];

/**
 * Selector de productos de la "Nueva cotización".
 *
 * Muestra todos los productos activos del sistema (datos reales de la API,
 * sin precios) con buscador y filtros. El asesor marca uno o varios y los
 * agrega de una vez; los que ya están en la cotización aparecen marcados y
 * no se vuelven a agregar (para cambiar la cantidad se usa el formulario).
 * Cerrar el modal no borra nada del formulario.
 *
 *   yaAgregados  ids de los productos que ya están en la cotización
 *   onAgregar(productos)  recibe los productos elegidos
 */
export default function SelectorProductosModal({ yaAgregados = [], onAgregar, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState({});
  const [elegidos, setElegidos] = useState([]);

  // Catálogo de la API. Un producto inactivo ya no se ofrece en cotizaciones nuevas
  const productos = useRecurso(productosService);
  const catalogo = useMemo(() => productos.filas.filter((p) => p.activo), [productos.filas]);
  const enCotizacion = useMemo(() => new Set(yaAgregados), [yaAgregados]);

  const options = useMemo(
    () => FILTERS.map((f) => ({ ...f, options: [...new Set(catalogo.map((p) => p[f.key]).filter(Boolean))] })),
    [catalogo],
  );

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogo.filter((p) => {
      const coincideTexto = !q || `${p.codigo} ${p.nombre} ${p.marca} ${p.medidas}`.toLowerCase().includes(q);
      const coincideFiltros = Object.entries(active).every(([k, v]) => !v?.length || v.includes(p[k]));
      return coincideTexto && coincideFiltros;
    });
  }, [catalogo, query, active]);

  const alternar = (id) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  const agregar = (cerrar) => {
    onAgregar(catalogo.filter((p) => elegidos.includes(p.id)));
    cerrar();
  };

  return (
    <Modal
      title="Productos"
      subtitle="Marca las llantas que van a la cotización."
      icon={<Package size={17} />}
      size="lg"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => agregar(cerrar)}
            disabled={elegidos.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} /> Agregar {elegidos.length > 0 ? `(${elegidos.length})` : ''}
          </button>
        </>
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

        <AvisoError mensaje={productos.error} />

        <p className="text-xs text-slate-400 dark:text-slate-500">
          {productos.cargando ? 'Cargando…' : `${filtrados.length} de ${catalogo.length} productos`}
          {elegidos.length > 0 && ` · ${elegidos.length} marcados`}
        </p>

        {/* ---- Listado ---- */}
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
          {productos.cargando && (
            <li className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-400">
              <LoaderCircle size={15} className="animate-spin" /> Cargando el catálogo…
            </li>
          )}
          {!productos.cargando &&
            filtrados.map((p) => {
              const yaEsta = enCotizacion.has(p.id);
              const marcado = elegidos.includes(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={`flex items-center gap-3 px-4 py-3 ${
                      yaEsta ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5'
                    } ${marcado ? 'bg-amber-400/10' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={yaEsta || marcado}
                      disabled={yaEsta}
                      onChange={() => alternar(p.id)}
                      className="h-4 w-4 shrink-0 accent-amber-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500">
                        {p.codigo} · {p.marca} · Medida {p.medidas}
                        {p.tipoVehiculo ? ` · ${p.tipoVehiculo}` : ''}
                      </span>
                    </span>
                    {yaEsta && (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check size={12} /> En la cotización
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          {!productos.cargando && filtrados.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              {catalogo.length === 0 ? 'Todavía no hay productos registrados.' : 'Ningún producto coincide con la búsqueda.'}
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
