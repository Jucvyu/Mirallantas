import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import BotonAccion from '../../../components/base/BotonAccion';
import StatusSwitch from '../../../components/base/StatusSwitch';
import AvisoError from '../../../components/base/AvisoError';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import {
  categoriasService,
  marcasService,
  modelosService,
  productosService,
  referenciasService,
  tiposVehiculoService,
} from '../../../services';
import { camposBasicos } from '../productos/camposProducto';

// Catálogo por productos (modelos de llanta) y sus medidas.
//
// Cada fila es UN producto (p. ej. "Michelin X Multi Z"), aunque se venda
// en muchas medidas. "Nuevo producto" pide solo lo básico y abre la página
// del producto, donde se cargan las medidas (una tabla), la ficha técnica y
// la foto. El lápiz de cada fila abre esa misma página. Al desplegar una
// fila se ven sus medidas y se pueden activar o desactivar ahí mismo.
//
// La gestión no maneja precios ni stock: el precio se define en cada
// cotización. Las llantas reencauchadas (unidad única con precio fijo) van
// en su propia tabla.

/** Formulario de la llanta reencauchada: su descripción, vehículo, precio y estado. */
function seccionesReencauchada({ tipos }) {
  return [
    {
      title: 'Llanta reencauchada',
      fields: [
        { key: 'codigo', label: 'Código del producto', only: ['edit', 'view'], soloLectura: true },
        { key: 'llantaReencauche', label: 'Llanta de origen', only: ['edit', 'view'], soloLectura: true },
        { key: 'medidas', label: 'Medida', required: true },
        { key: 'tipoVehiculo', label: 'Tipo de vehículo', type: 'buscador', options: tipos.map((t) => t.nombre) },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2, max: 200 },
        {
          key: 'precioVenta',
          label: 'Precio de venta (COP)',
          type: 'money',
          required: true,
          hint: 'Es una sola unidad con precio fijo. Sin precio no se ofrece en el catálogo.',
        },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo },
      ],
    },
  ];
}

const etiqueta = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold';

const columnasModelo = [
  {
    key: 'nombre',
    label: 'Producto',
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <Link to={`/admin/productos/${row.id}`} className="font-semibold text-slate-800 hover:text-amber-700 dark:text-slate-100 dark:hover:text-amber-400">
          {row.nombre}
        </Link>
        {!row.foto && (
          <span title="El producto no tiene foto" className={`${etiqueta} bg-amber-400/15 text-amber-600 dark:text-amber-400`}>
            <TriangleAlert size={10} aria-hidden="true" /> Sin foto
          </span>
        )}
      </span>
    ),
  },
  { key: 'marca', label: 'Marca' },
  { key: 'categoria', label: 'Categoría' },
  {
    key: 'medidas',
    label: 'Medidas',
    render: (row) =>
      row.referencias.length === 0 ? (
        <span className={`${etiqueta} bg-amber-400/15 text-amber-600 dark:text-amber-400`}>
          <TriangleAlert size={10} aria-hidden="true" /> Sin medidas
        </span>
      ) : (
        <span className="block max-w-[16rem]">
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {row.referencias.length} {row.referencias.length === 1 ? 'medida' : 'medidas'}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{row.medidas}</span>
        </span>
      ),
    exportar: (row) => row.medidas ?? '',
  },
  { key: 'estado', label: 'Estado' },
];

const columnasReencauchada = [
  {
    key: 'nombre',
    label: 'Llanta',
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        {row.descripcion || row.nombre}
        <span
          title={row.llantaReencauche ? `Llanta ${row.llantaReencauche}` : 'Llanta reencauchada'}
          className={`${etiqueta} bg-slate-500/15 text-slate-600 dark:text-slate-300`}
        >
          {row.reservada ? 'Apartada' : row.precioVentaValor ? 'Única' : 'Sin precio'}
        </span>
      </span>
    ),
  },
  { key: 'codigo', label: 'Código' },
  { key: 'medidas', label: 'Medida' },
  { key: 'precioVenta', label: 'Precio', render: (row) => (row.precioVenta ? `$ ${row.precioVenta}` : '—') },
  { key: 'estado', label: 'Estado' },
];

/** Medidas de un producto, bajo su fila: se ven y se activan; se editan en su página. */
function MedidasDelModelo({ modelo, onEstado }) {
  const enlace = `/admin/productos/${modelo.id}?pestana=medidas`;
  if (modelo.referencias.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
        Este producto todavía no tiene medidas y no sale en el catálogo.{' '}
        <Link to={enlace} className="font-bold text-amber-700 hover:underline dark:text-amber-400">
          Agregar medidas
        </Link>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-200/70 rounded-xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-brand-navy-800">
        {modelo.referencias.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5">
            <p className="min-w-0 text-sm">
              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{r.medidas}</span>
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                {[r.posicion, r.indiceCarga, r.codigo].filter(Boolean).join(' · ')}
              </span>
            </p>
            <StatusSwitch value={r.estado} options={estadosActivo} onChange={(estado) => onEstado(r, estado)} label={`Estado de ${r.medidas}`} />
          </li>
        ))}
      </ul>
      <Link to={enlace} className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:underline dark:text-amber-400">
        <Pencil size={13} aria-hidden="true" /> Editar medidas
      </Link>
    </div>
  );
}

export default function ProductosPage() {
  const navigate = useNavigate();
  // Listas para los selects del formulario
  const categorias = useRecurso(categoriasService);
  const marcas = useRecurso(marcasService);
  const tipos = useRecurso(tiposVehiculoService);
  const modelos = useRecurso(modelosService);
  // Todas las medidas del catálogo, para agruparlas por producto
  const referencias = useRecurso(referenciasService);
  const productos = useRecurso(productosService);
  const [errorMedida, setErrorMedida] = useState('');

  const contexto = { categorias: categorias.filas, marcas: marcas.filas, tipos: tipos.filas };

  // Cada producto con sus medidas. El de las reencauchadas va en su propia tabla.
  const filasModelos = useMemo(() => {
    const porModelo = new Map();
    for (const r of referencias.filas) {
      if (r.reencauchada) continue;
      porModelo.set(r.modeloId, [...(porModelo.get(r.modeloId) ?? []), r]);
    }
    return modelos.filas.filter((m) => !m.deReencauchadas).map((m) => ({ ...m, referencias: porModelo.get(m.id) ?? [] }));
  }, [modelos.filas, referencias.filas]);

  const reencauchadas = useMemo(() => productos.filas.filter((p) => p.reencauchada), [productos.filas]);

  /** Crea el producto con lo básico y abre su página para cargar las medidas. */
  const crear = async (valores) => {
    const nuevo = await modelosService.crear(valores, contexto);
    navigate(`/admin/productos/${nuevo.id}?pestana=medidas`);
  };

  const cambiarEstadoMedida = async (modelo, referencia, estado) => {
    setErrorMedida('');
    try {
      await modelosService.cambiarEstadoReferencia(modelo, referencia, estado);
      await referencias.recargar();
    } catch (e) {
      setErrorMedida(e.message);
    }
  };

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Productos']} />
      <AvisoError mensaje={errorMedida} />
      <DataTable
        title="Productos"
        columns={columnasModelo}
        data={filasModelos}
        cargando={modelos.cargando || referencias.cargando}
        error={modelos.error || referencias.error}
        onRecargar={() => Promise.all([modelos.recargar(), referencias.recargar()])}
        onCreate={crear}
        onStatusChange={(fila, estado) => modelos.ejecutar(() => modelosService.cambiarEstado(fila, estado))}
        newLabel="Nuevo producto"
        formSections={[
          {
            title: 'Lo básico',
            fields: camposBasicos(contexto).map((f) =>
              f.key === 'nombre' ? { ...f, hint: 'Después agregas sus medidas, la ficha técnica y la foto.' } : f,
            ),
          },
        ]}
        entityName="producto"
        exportable={false}
        canView={false}
        // Un producto con ventas o compras no se borra: se desactiva
        canDelete={false}
        rowActions={(fila) => (
          <BotonAccion icono={Pencil} etiqueta="Abrir el producto" accion="editar" onClick={() => navigate(`/admin/productos/${fila.id}`)} />
        )}
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        expandir={(m) => <MedidasDelModelo modelo={m} onEstado={(referencia, estado) => cambiarEstadoMedida(m, referencia, estado)} />}
        filters={[
          { key: 'categoria', label: 'Categoría', options: categorias.filas.map((c) => c.nombre) },
          { key: 'marca', label: 'Marca', options: marcas.filas.map((m) => m.nombre) },
          { key: 'tipoVehiculo', label: 'Vehículo', options: tipos.filas.map((t) => t.nombre) },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Cada fila es un producto con todas sus medidas. Ábrelo con el lápiz para editar sus medidas, la ficha técnica y la foto.
      </p>

      {(reencauchadas.length > 0 || productos.cargando) && (
        <div className="mt-10">
          <DataTable
            title="Llantas reencauchadas"
            columns={columnasReencauchada}
            data={reencauchadas}
            cargando={productos.cargando}
            error={productos.error}
            onRecargar={productos.recargar}
            onEdit={(fila, valores) => productos.editar(fila, { ...fila, ...valores }, contexto)}
            onStatusChange={(fila, estado) => productos.ejecutar(() => productosService.cambiarEstado(fila, estado))}
            formSections={seccionesReencauchada({ tipos: tipos.filas })}
            entityName="llanta reencauchada"
            entityGender="f"
            titleKey="descripcion"
            exportable={false}
            canDelete={false}
            statusKey="estado"
            statusOptions={estadosActivo}
            statusVariant="switch"
          />
        </div>
      )}
    </div>
  );
}
