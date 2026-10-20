import { useMemo } from 'react';
import { TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { categoriasService, marcasService, productosService, tiposVehiculoService } from '../../../services';
import { formatCOP } from '../../../utils/formato';

// Tabla `producto`. El código lo genera el servidor (ML-000001…) y no
// cambia al editar. El formulario no pide precio de compra (pertenece a
// cada compra) y el aplicativo no maneja stock.
const columns = [
  { key: 'codigo', label: 'Código' },
  {
    key: 'nombre',
    label: 'Producto',
    // Aviso discreto cuando el producto no tiene ninguna imagen cargada
    render: (row) => (
      <span className="flex items-center gap-2">
        {row.nombre}
        {!row.imagenes?.length && (
          <span
            title="El producto no tiene imágenes cargadas"
            className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
          >
            <TriangleAlert size={10} /> Sin foto
          </span>
        )}
      </span>
    ),
  },
  { key: 'categoria', label: 'Categoría' },
  { key: 'marca', label: 'Marca' },
  { key: 'medidas', label: 'Medidas' },
  { key: 'precioVenta', label: 'Precio venta', render: (row) => formatCOP(row.precioVenta) },
  { key: 'estado', label: 'Estado' },
];

/** Formulario: las listas de categorías, marcas y vehículos vienen de la API. */
function seccionesFormulario({ categorias, marcas, tipos, medidas }) {
  const activos = (lista) => lista.filter((x) => x.activo !== false).map((x) => x.nombre);
  return [
    {
      title: 'Identificación',
      fields: [
        // El código lo asigna el servidor al guardar y no cambia
        { key: 'codigo', label: 'Código del producto', only: ['edit', 'view'], soloLectura: true },
        { key: 'nombre', label: 'Nombre', required: true },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2 },
        { key: 'categoria', label: 'Categoría', type: 'select', required: true, options: activos(categorias), emptyLabel: 'categoría' },
        { key: 'marca', label: 'Marca', type: 'select', required: true, options: activos(marcas), emptyLabel: 'marca' },
        // Buscador de las medidas ya registradas; si es nueva, se escribe
        {
          key: 'medidas',
          label: 'Medidas',
          type: 'buscador',
          required: true,
          options: medidas,
          permitirNuevo: true,
          placeholderBusqueda: 'Escribe la medida, p. ej. 195/65R15',
          hint: 'Busca una medida existente o escribe una nueva.',
        },
        { key: 'tipoVehiculo', label: 'Tipo de vehículo', type: 'select', options: tipos.map((t) => t.nombre) },
      ],
    },
    {
      title: 'Precio',
      fields: [
        {
          key: 'precioVenta',
          label: 'Precio de venta (COP)',
          type: 'money',
          required: true,
          placeholder: '280.000',
          hint: 'Precio de lista sugerido para las cotizaciones.',
        },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
      ],
    },
    {
      title: 'Imagen',
      fields: [
        {
          key: 'foto',
          label: 'Foto del producto',
          type: 'image',
          span: 2,
          placeholder: 'Sube la foto de la llanta (JPG o PNG)',
        },
      ],
    },
  ];
}

export default function ProductosPage() {
  // Listas para los selects del formulario
  const categorias = useRecurso(categoriasService);
  const marcas = useRecurso(marcasService);
  const tipos = useRecurso(tiposVehiculoService);
  const productos = useRecurso(productosService);

  // El servicio usa estas listas para enviar los nombres elegidos como ids
  const contexto = { categorias: categorias.filas, marcas: marcas.filas, tipos: tipos.filas };
  // Medidas registradas, sin repetir: salen del catálogo ya cargado (no se
  // vuelven a pedir a la API)
  const medidas = useMemo(
    () => [...new Set(productos.filas.map((p) => p.medidas).filter(Boolean))].sort(),
    [productos.filas],
  );

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Productos']} />
      <DataTable
        title="Productos"
        columns={columns}
        data={productos.filas}
        cargando={productos.cargando}
        error={productos.error}
        onRecargar={productos.recargar}
        onCreate={(valores) => productos.crear(valores, contexto)}
        onEdit={(fila, valores) => productos.editar(fila, valores, contexto)}
        onStatusChange={(fila, estado) => productos.ejecutar(() => productosService.cambiarEstado(fila, estado))}
        newLabel="Nuevo producto"
        formSections={seccionesFormulario({ categorias: categorias.filas, marcas: marcas.filas, tipos: tipos.filas, medidas })}
        entityName="producto"
        exportable={false}
        // Un producto con ventas o compras no se borra: se desactiva
        canDelete={false}
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[
          { key: 'categoria', label: 'Categoría', options: categorias.filas.map((c) => c.nombre) },
          { key: 'marca', label: 'Marca', options: marcas.filas.map((m) => m.nombre) },
          { key: 'tipoVehiculo', label: 'Vehículo', options: tipos.filas.map((t) => t.nombre) },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
    </div>
  );
}
