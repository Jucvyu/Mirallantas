import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo, tiposDocumento } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesService } from '../../../services';

// Tabla `cliente`: tipo_documento, numero_documento, nombre_completo,
// telefono, correo, direccion, estado.
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'nombreCompleto', label: 'Nombre completo' },
  { key: 'numeroDocumento', label: 'Documento' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo' },
  { key: 'estado', label: 'Estado' },
];

const formSections = [
  {
    title: 'Identificación',
    fields: [
      { key: 'nombreCompleto', label: 'Nombre completo', required: true, span: 2 },
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: tiposDocumento },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'number', required: true },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      { key: 'correo', label: 'Correo electrónico', type: 'email', required: true },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: true },
      { key: 'direccion', label: 'Dirección', span: 2, placeholder: 'Calle 50 #45-12, Medellín' },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
    ],
  },
];

export default function ClientesPage() {
  // La pantalla no conoce la API: le pide todo al servicio de clientes
  const clientes = useRecurso(clientesService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Clientes']} />
      <DataTable
        title="Clientes"
        columns={columns}
        data={clientes.filas}
        cargando={clientes.cargando}
        error={clientes.error}
        onRecargar={clientes.recargar}
        onCreate={clientes.crear}
        onEdit={clientes.editar}
        onDelete={clientes.eliminar}
        // El interruptor activa o desactiva sin abrir el formulario
        onStatusChange={(fila, estado) => clientes.ejecutar(() => clientesService.cambiarEstado(fila, estado))}
        newLabel="Nuevo cliente"
        formSections={formSections}
        entityName="cliente"
        titleKey="nombreCompleto"
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[
          { key: 'estado', label: 'Estado', options: estadosActivo },
          { key: 'tipoDocumento', label: 'Documento', options: tiposDocumento },
        ]}
      />
    </div>
  );
}
