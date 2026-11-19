import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo, tiposDocumento } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { tercerosService } from '../../../services';

// Tabla `tercero`: las reencauchadoras que ejecutan físicamente el
// servicio. En el modelo comparte los mismos campos que proveedor.
const columns = [
  { key: 'nombreRazonSocial', label: 'Reencauchadora' },
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

export default function TercerosPage() {
  const terceros = useRecurso(tercerosService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Terceros']} />
      <DataTable
        title="Terceros (reencauchadoras)"
        columns={columns}
        data={terceros.filas}
        cargando={terceros.cargando}
        error={terceros.error}
        onRecargar={terceros.recargar}
        onCreate={terceros.crear}
        onEdit={terceros.editar}
        onDelete={terceros.eliminar}
        onStatusChange={(fila, estado) => terceros.ejecutar(() => tercerosService.cambiarEstado(fila, estado))}
        newLabel="Nuevo tercero"
        formSections={formSections}
        entityName="tercero"
        titleKey="nombreRazonSocial"
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[{ key: 'estado', label: 'Estado', options: estadosActivo }]}
      />
    </div>
  );
}
