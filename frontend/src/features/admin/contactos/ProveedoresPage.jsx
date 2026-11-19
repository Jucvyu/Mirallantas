import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo, tiposDocumento } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { proveedoresService } from '../../../services';

// Tabla `proveedor`: tipo_documento, numero_documento, nombre o razón
// social, contacto, telefono, correo, direccion, estado.
const columns = [
  { key: 'nombreRazonSocial', label: 'Nombre o razón social' },
  { key: 'numeroDocumento', label: 'Documento' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'estado', label: 'Estado' },
];

const formSections = [
  {
    title: 'Identificación',
    fields: [
      { key: 'nombreRazonSocial', label: 'Nombre o razón social', required: true, span: 2 },
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: tiposDocumento },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'documento', required: true },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      { key: 'contacto', label: 'Persona de contacto' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: true },
      { key: 'correo', label: 'Correo electrónico', type: 'email', required: true },
      { key: 'direccion', label: 'Dirección', span: 2 },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
    ],
  },
];

export default function ProveedoresPage() {
  const proveedores = useRecurso(proveedoresService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Proveedores']} />
      <DataTable
        title="Proveedores"
        columns={columns}
        data={proveedores.filas}
        cargando={proveedores.cargando}
        error={proveedores.error}
        onRecargar={proveedores.recargar}
        onCreate={proveedores.crear}
        onEdit={proveedores.editar}
        onDelete={proveedores.eliminar}
        onStatusChange={(fila, estado) => proveedores.ejecutar(() => proveedoresService.cambiarEstado(fila, estado))}
        newLabel="Nuevo proveedor"
        formSections={formSections}
        entityName="proveedor"
        titleKey="nombreRazonSocial"
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[
          { key: 'nombreRazonSocial', label: 'Nombre o razón social' },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
    </div>
  );
}
