import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { tercerosService } from '../../../services';
import { columnaNombre, formularioEmpresaExterna, tiposPersona, valoresInicialesEmpresaExterna } from './formularioEmpresaExterna';

// Tabla `tercero`: las reencauchadoras que ejecutan físicamente el servicio.
// Persona natural o jurídica, con el mismo formulario de proveedores
// (formularioEmpresaExterna.jsx).
const columns = [
  columnaNombre('Reencauchadora'),
  { key: 'numeroDocumento', label: 'Documento' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'estado', label: 'Estado' },
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
        formSections={formularioEmpresaExterna}
        formInitialValues={valoresInicialesEmpresaExterna}
        entityName="tercero"
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
