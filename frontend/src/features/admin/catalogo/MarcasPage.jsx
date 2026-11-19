import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { marcasService } from '../../../services';

// Catálogo de marcas: los productos se asocian a una marca y el catálogo
// del cliente filtra por ella.
const formSections = [
  {
    title: 'Datos de la marca',
    fields: [
      { key: 'nombre', label: 'Nombre de la marca', required: true, span: 2, placeholder: 'Michelin' },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
    ],
  },
];

export default function MarcasPage() {
  const marcas = useRecurso(marcasService);

  const columns = [
    { key: 'nombre', label: 'Marca' },
    { key: 'estado', label: 'Estado' },
  ];

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Marcas']} />
      <DataTable
        title="Marcas"
        columns={columns}
        data={marcas.filas}
        cargando={marcas.cargando}
        error={marcas.error}
        onRecargar={marcas.recargar}
        onCreate={marcas.crear}
        onEdit={marcas.editar}
        onDelete={marcas.eliminar}
        onStatusChange={(fila, estado) => marcas.ejecutar(() => marcasService.cambiarEstado(fila, estado))}
        newLabel="Nueva marca"
        formSections={formSections}
        entityName="marca"
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[{ key: 'estado', label: 'Estado', options: estadosActivo }]}
      />
    </div>
  );
}
