import { Fragment, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import AvisoError from '../AvisoError';
import BotonAccion from '../BotonAccion';
import Dropdown from '../Dropdown';
import { BORDER_OK, INPUT } from '../formStyles';
import FormModal from '../FormModal';
import ConfirmDialog from '../ConfirmDialog';
import Skeleton, { SkeletonFilas } from '../Skeleton';
import StatusSelect from '../StatusSelect';
import StatusSwitch from '../StatusSwitch';

const PAGE_SIZE = 8;

/** Columna de acciones: fija a la derecha, con el fondo de la tarjeta para tapar lo que pasa por debajo. */
const CELDA_ACCIONES =
  'sticky right-0 z-10 bg-white px-3 pr-5 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] dark:bg-brand-navy-800';

/**
 * Artículo que le corresponde al nombre de la entidad, para que los
 * títulos digan "Nueva venta" y no "Nuevo venta".
 *
 * Se deduce de la terminación —a, -ión, -dad, -tud y -umbre son femeninas—
 * y se puede forzar con la prop `entityGender`.
 */
function esFemenino(nombre) {
  return /(a|ión|dad|tud|umbre)$/i.test(String(nombre).trim());
}

/** Esquema de formulario por defecto cuando la página no define uno propio. */
function fallbackSections(columns) {
  return [
    {
      title: 'Datos del registro',
      fields: columns
        .filter((c) => c.key !== 'id')
        .map((c) => ({ key: c.key, label: c.label, placeholder: c.label })),
    },
  ];
}

/**
 * Tabla genérica del panel administrativo: buscador, filtros, paginación y
 * acciones por fila.
 *
 * La tabla NO guarda datos: muestra las filas que recibe (`data`) y, cuando
 * el usuario hace algo, llama a la función correspondiente. Esas funciones
 * normalmente guardan en la API y vuelven a cargar el listado (ver el hook
 * useRecurso). Todas pueden ser asíncronas: si fallan, la tabla muestra el
 * mensaje de error.
 *
 * Datos
 *   data         filas a mostrar, cada una con un `id` único
 *   cargando     muestra filas grises (skeleton) mientras llegan los datos
 *   error        mensaje si no se pudieron cargar
 *   onRecargar   se llama al pulsar el botón de refrescar
 *
 * Acciones (si una no se pasa, su botón no aparece)
 *   onCreate(values)          guardar un registro nuevo
 *   onEdit(row, values)       guardar los cambios de una fila
 *   onDelete(row)             eliminar una fila
 *   onStatusChange(row, v)    cambio de estado desde la propia fila
 *   onRowUpdate(row, patch)   cambio hecho por una celda o acción a medida;
 *                             llega a `render` y `rowActions` como `update(patch)`
 *
 * Presentación
 *   columns: [{ key, label, render?(row, { update }) }]
 *   formSections: esquema del formulario de crear/editar/ver (ver FormModal)
 *   entityName: nombre en singular, para los títulos ("usuario")
 *   statusKey / statusOptions / statusVariant ('select' | 'switch') / statusFlow
 *   filters: [{ key, label, options? }] filtros de la barra superior
 *   createModal: ({ onSubmit, onClose }) => nodo, formulario de "Nuevo" a medida
 *   rowActions: (row, { update }) => nodo, botones extra en cada fila
 *   formValidate: (values) => ({ campo: 'mensaje' }) reglas entre campos
 *   exportable, canView / canEdit / canDelete, entityGender, titleKey
 *   (canEdit y canDelete también aceptan una función (row) => boolean para
 *   bloquear filas concretas, p. ej. el rol Administrador)
 *   canChangeStatus: (row) => boolean — si es false, el estado de esa fila
 *   se muestra pero no se puede cambiar
 *   rowClassName: (row) => clases extra de la fila (p. ej. resaltarla)
 *   expandir: (row) => nodo | null — contenido desplegable bajo la fila
 *
 * Los filtros admiten varias opciones a la vez: `activeFilters[k]` es un
 * arreglo y la fila entra si coincide con cualquiera de las marcadas.
 */
export default function DataTable({
  columns,
  data = [],
  cargando = false,
  error = '',
  onRecargar,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  onRowUpdate,
  title,
  newLabel = 'Nuevo registro',
  statusKey,
  toolbar = true,
  readOnly = false,
  formSections,
  entityName = 'registro',
  titleKey = 'nombre',
  statusOptions,
  statusVariant = 'select',
  filters = [],
  createModal,
  rowActions,
  statusFlow,
  formValidate,
  exportable = true,
  canView = true,
  canEdit = true,
  canDelete = true,
  canChangeStatus,
  rowClassName,
  expandir,
  entityGender,
}) {
  const femenino = entityGender ? entityGender === 'f' : esFemenino(entityName);
  const nuevo = femenino ? 'Nueva' : 'Nuevo';
  const rows = data;

  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(1);
  // { mode: 'create' | 'edit' | 'view' | 'delete', row }
  const [dialog, setDialog] = useState(null);
  // Filas desplegadas (cuando la tabla tiene contenido desplegable)
  const [abiertas, setAbiertas] = useState(() => new Set());
  const alternarFila = (id) =>
    setAbiertas((prev) => {
      const nuevas = new Set(prev);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.add(id);
      return nuevas;
    });
  // Error de una acción hecha directamente sobre la fila (cambio de estado…)
  const [errorAccion, setErrorAccion] = useState('');

  const sections = useMemo(
    () => formSections ?? fallbackSections(columns),
    [formSections, columns],
  );

  const filterDefs = useMemo(
    () =>
      filters.map((f) => ({
        ...f,
        options: f.options ?? [...new Set(rows.map((r) => r[f.key]).filter(Boolean))],
      })),
    [filters, rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || Object.values(row).some((v) => String(v).toLowerCase().includes(q));
      // Cada filtro guarda un arreglo: sin marcas no filtra, y con varias
      // basta con que la fila coincida con una de ellas.
      const matchesFilters = Object.entries(activeFilters).every(
        ([k, v]) => !v?.length || v.includes(String(row[k])),
      );
      return matchesQuery && matchesFilters;
    });
  }, [rows, query, activeFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Si un filtro o un borrado deja la página actual vacía, se vuelve a la última
  const paginaVisible = Math.min(page, totalPages);
  const pageRows = filtered.slice((paginaVisible - 1) * PAGE_SIZE, paginaVisible * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (paginaVisible - 1) * PAGE_SIZE + 1;
  const to = Math.min(paginaVisible * PAGE_SIZE, filtered.length);

  /**
   * Ejecuta una acción sobre una fila (cambio de estado, anular…) y, si la
   * API la rechaza, muestra el mensaje encima de la tabla. Devuelve true si
   * salió bien, para que la celda que la pidió sepa si debe cerrarse.
   */
  const ejecutar = async (accion) => {
    setErrorAccion('');
    try {
      await accion();
      return true;
    } catch (e) {
      setErrorAccion(e.message);
      return false;
    }
  };

  /** Función `update(patch)` que reciben las celdas y acciones a medida. */
  const updateDe = (row) => (patch) => ejecutar(() => onRowUpdate?.(row, patch));

  const puedeCrear = toolbar && Boolean(onCreate);
  /** ¿Se puede editar / eliminar esta fila? */
  const permite = (regla, row) => (typeof regla === 'function' ? regla(row) : Boolean(regla));
  const puedeEditar = (row) => !readOnly && Boolean(onEdit) && permite(canEdit, row);
  const puedeEliminar = (row) => !readOnly && Boolean(onDelete) && permite(canDelete, row);
  // El botón aparece si el módulo tiene la acción; si la fila no la permite
  // (regla por fila), se muestra deshabilitado en vez de desaparecer
  const muestraEditar = !readOnly && Boolean(onEdit) && canEdit !== false;
  const muestraEliminar = !readOnly && Boolean(onDelete) && canDelete !== false;

  // ---- Piezas de cada fila (las usan la tabla y las tarjetas) ----------

  /** Valores cortos (fechas, números, montos) no se parten en dos líneas. */
  const esCorto = (valor) => (typeof valor === 'string' || typeof valor === 'number') && String(valor).length <= 18;

  /** Contenido de una celda: estado editable, render a medida o el valor. */
  const contenidoCelda = (row, col) => {
    const cambiaEstado = onStatusChange && (!canChangeStatus || canChangeStatus(row));
    const alCambiarEstado = cambiaEstado ? (v) => ejecutar(() => onStatusChange(row, v)) : undefined;
    if (col.key === statusKey && statusVariant === 'switch') {
      return <StatusSwitch value={row[col.key]} options={statusOptions} onChange={alCambiarEstado} />;
    }
    if (col.key === statusKey) {
      return <StatusSelect value={row[col.key]} options={statusOptions} flow={statusFlow} onChange={alCambiarEstado} />;
    }
    if (col.render) return col.render(row, { update: updateDe(row) });
    return row[col.key];
  };

  /**
   * Botones de una fila, siempre en una sola línea: desplegar, acciones a
   * medida, ver, editar y eliminar. Todas las filas muestran los mismos
   * iconos; los que no aplican a la fila quedan deshabilitados.
   */
  const botonesFila = (row, desplegable, abierta) => (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1">
      {expandir && (
        <BotonAccion
          icono={abierta ? ChevronUp : ChevronDown}
          etiqueta={abierta ? 'Ocultar el detalle' : 'Desplegar el detalle'}
          tono="acento"
          deshabilitado={!desplegable}
          motivo="No tiene detalle"
          onClick={() => alternarFila(row.id)}
        />
      )}
      {rowActions?.(row, { update: updateDe(row) })}
      {canView && <BotonAccion icono={Eye} etiqueta="Ver detalle" onClick={() => setDialog({ mode: 'view', row })} />}
      {muestraEditar && (
        <BotonAccion
          icono={Pencil}
          etiqueta="Editar"
          deshabilitado={!puedeEditar(row)}
          motivo="Este registro ya no se puede editar"
          onClick={() => setDialog({ mode: 'edit', row })}
        />
      )}
      {muestraEliminar && (
        <BotonAccion
          icono={Trash2}
          etiqueta="Eliminar"
          tono="peligro"
          deshabilitado={!puedeEliminar(row)}
          motivo="Este registro no se puede eliminar"
          onClick={() => setDialog({ mode: 'delete', row })}
        />
      )}
    </div>
  );

  /** Mientras llegan las primeras filas se ven bloques grises en su lugar. */
  const esqueleto = cargando && pageRows.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title && <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{title}</h1>}
        {toolbar && (
          <div className="flex items-center gap-2">
            {exportable && (
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700">
                <Download size={15} /> Exportar
              </button>
            )}
            {puedeCrear && (
              <button
                onClick={() => setDialog({ mode: 'create' })}
                className="ml-pulsable inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
              >
                <Plus size={15} /> {newLabel}
              </button>
            )}
          </div>
        )}
      </div>

      <AvisoError mensaje={error || errorAccion} className="mt-4" />

      <div className="mt-5 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar..."
              className={`${INPUT} ${BORDER_OK} py-2 pl-9 pr-3`}
            />
          </div>
          {filterDefs.map((f) => (
            <Dropdown
              key={f.key}
              label={f.label}
              multiple
              value={activeFilters[f.key] ?? []}
              options={f.options}
              onChange={(valores) => {
                setActiveFilters((a) => ({ ...a, [f.key]: valores }));
                setPage(1);
              }}
              icon={<SlidersHorizontal size={13} className="shrink-0 opacity-70" />}
            />
          ))}
          <button
            onClick={() => {
              setQuery('');
              setActiveFilters({});
              setErrorAccion('');
              onRecargar?.();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-brand-navy-700"
            aria-label="Refrescar"
            title="Quitar filtros y volver a cargar"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* ---- Escritorio: el texto largo baja de línea en vez de estirar la
             columna. Si aun así no cabe, la tabla se desplaza de lado y la
             columna de acciones queda fija a la derecha ---- */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full table-auto text-left text-sm">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-3 align-bottom first:pl-5">
                    {col.label}
                  </th>
                ))}
                <th className={`${CELDA_ACCIONES} py-3 text-right align-bottom`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const desplegable = expandir?.(row);
                const abierta = abiertas.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`border-t border-slate-100 text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/5 dark:text-slate-300 dark:hover:bg-white/[0.03] ${rowClassName?.(row) ?? ''}`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-3 align-top first:pl-5 ${
                            esCorto(row[col.key]) ? 'whitespace-nowrap' : 'break-words [overflow-wrap:anywhere]'
                          }`}
                        >
                          {contenidoCelda(row, col)}
                        </td>
                      ))}
                      <td className={`${CELDA_ACCIONES} py-3 align-top`}>{botonesFila(row, desplegable, abierta)}</td>
                    </tr>
                    {desplegable && abierta && (
                      <tr className="border-t border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-white/[0.02]">
                        <td colSpan={columns.length + 1} className="px-5 py-4">
                          {desplegable}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {esqueleto && <SkeletonFilas filas={5} columnas={columns.length + 1} />}
              {!cargando && pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-5 py-10 text-center text-sm text-slate-400">
                    Sin resultados encontrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ---- Celular y tableta: una tarjeta por fila, con todas sus
             columnas (nada se oculta) y sus acciones a la vista ---- */}
        <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-white/5 dark:border-white/5 lg:hidden">
          {pageRows.map((row) => {
            const desplegable = expandir?.(row);
            const abierta = abiertas.has(row.id);
            const [principal, ...resto] = columns;
            return (
              <li key={row.id} className={`px-4 py-4 text-slate-600 dark:text-slate-300 ${rowClassName?.(row) ?? ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 break-words text-sm font-bold text-slate-800 dark:text-slate-100">
                    {contenidoCelda(row, principal)}
                  </div>
                  {botonesFila(row, desplegable, abierta)}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
                  {resto.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {col.label}
                      </dt>
                      <dd className="mt-0.5 break-words">{contenidoCelda(row, col) ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
                {desplegable && abierta && <div className="mt-4">{desplegable}</div>}
              </li>
            );
          })}
          {esqueleto &&
            Array.from({ length: 4 }, (_, i) => (
              <li key={i} aria-hidden="true" className="space-y-3 px-4 py-4">
                <Skeleton className="h-4 w-1/2" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          {!cargando && pageRows.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">Sin resultados encontrados.</li>
          )}
        </ul>

        <div className="flex items-center justify-between px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Mostrando {from}-{to} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, paginaVisible - 1))}
              disabled={paginaVisible === 1}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
            >
              ‹
            </button>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400 font-semibold text-slate-900">
              {paginaVisible}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, paginaVisible + 1))}
              disabled={paginaVisible === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {dialog?.mode === 'create' && createModal
        ? createModal({ onSubmit: onCreate, onClose: () => setDialog(null) })
        : null}

      {dialog?.mode === 'create' && !createModal && (
        <FormModal
          mode="create"
          title={`${nuevo} ${entityName}`}
          subtitle="Completa los campos marcados con * para registrar."
          sections={sections}
          validate={formValidate}
          submitLabel={`Guardar ${entityName}`}
          onSubmit={onCreate}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === 'edit' && (
        <FormModal
          mode="edit"
          title={`Editar ${entityName}`}
          subtitle={String(dialog.row.id)}
          sections={sections}
          initialValues={dialog.row}
          validate={formValidate}
          onSubmit={(values) => onEdit(dialog.row, values)}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === 'view' && (
        <FormModal
          mode="view"
          title={`Detalle de ${femenino ? 'la' : 'el'} ${entityName}`}
          subtitle={String(dialog.row.id)}
          sections={sections}
          initialValues={dialog.row}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.mode === 'delete' && (
        <ConfirmDialog
          record={{
            title: dialog.row[titleKey] ?? dialog.row.id,
            subtitle: dialog.row[titleKey] ? String(dialog.row.id) : null,
          }}
          onConfirm={() => onDelete(dialog.row)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
