import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { categoriasService, productosService } from '../../../services';

// Tabla `categoria`: nombre, descripcion, color, estado. El color se usa
// para marcar la categoría en el catálogo del cliente.
const formSections = [
  {
    title: 'Datos de la categoría',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true, span: 2, placeholder: 'Turismo' },
      { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2 },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
    ],
  },
  {
    title: 'Color',
    fields: [
      {
        key: 'color',
        label: 'Color de la categoría',
        type: 'color',
        span: 2,
        hint: 'Es el color con el que se marca la categoría en el catálogo del cliente.',
      },
    ],
  },
];

export default function CategoriasPage() {
  const categorias = useRecurso(categoriasService);
  // Los productos se piden solo para contar cuántos hay en cada categoría
  const productos = useRecurso(productosService);

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'nombre',
      label: 'Categoría',
      render: (row) => (
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
            style={{ backgroundColor: row.color ?? '#94A3B8' }}
          />
          {row.nombre}
        </span>
      ),
    },
    { key: 'descripcion', label: 'Descripción' },
    {
      key: 'productos',
      label: 'Productos',
      render: (row) => productos.filas.filter((p) => p.categoriaId === row.id).length,
    },
  ];

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Categorías']} />
      <DataTable
        title="Categorías"
        columns={columns}
        data={categorias.filas}
        cargando={categorias.cargando}
        error={categorias.error}
        onRecargar={categorias.recargar}
        onCreate={categorias.crear}
        onEdit={categorias.editar}
        newLabel="Nueva categoría"
        formSections={formSections}
        entityName="categoría"
        exportable={false}
        canView={false}
        canDelete={false}
        filters={[{ key: 'estado', label: 'Estado', options: estadosActivo }]}
      />
    </div>
  );
}
