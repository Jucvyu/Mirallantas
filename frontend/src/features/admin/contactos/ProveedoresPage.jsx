import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { proveedoresService } from '../../../services';
import { columnaNombre, formularioEmpresaExterna, tiposPersona, valoresInicialesEmpresaExterna } from './formularioEmpresaExterna';

// Tabla `proveedor`: a quién se le compran las llantas.
// Persona natural o jurídica, con el mismo formulario de terceros
// (formularioEmpresaExterna.jsx).
const columns = [
  columnaNombre('Nombre o razón social'),
  { key: 'numeroDocumento', label: 'Documento' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'estado', label: 'Estado' },
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
        formSections={formularioEmpresaExterna}
        formInitialValues={valoresInicialesEmpresaExterna}
        entityName="proveedor"
        titleKey="nombreRazonSocial"
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[
          { key: 'tipoPersona', label: 'Tipo de persona', options: tiposPersona },
          { key: 'nombreRazonSocial', label: 'Nombre o razón social' },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
    </div>
  );
}
