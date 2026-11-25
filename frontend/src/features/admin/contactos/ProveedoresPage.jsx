import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo, tiposDocumento } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { proveedoresService } from '../../../services';

// Tabla `proveedor`: tipo_persona (Natural o Jurídica, migración 0044),
// tipo_documento, numero_documento, nombre o razón social, contacto,
// telefono, correo, direccion, estado.
//
// El formulario pregunta primero el tipo de persona y, según eso, pide:
//   Natural   nombre completo, documento de persona (CC, CE, Pasaporte o NIT)
//             y la persona de contacto como opcional.
//   Jurídica  razón social, NIT y la persona de contacto (obligatoria).
const NATURAL = 'Natural';
const JURIDICA = 'Jurídica';
const esJuridica = (v) => v.tipoPersona === JURIDICA;

const columns = [
  {
    key: 'nombreRazonSocial',
    label: 'Nombre o razón social',
    render: (p) => (
      <div>
        <p>{p.nombreRazonSocial}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Persona {p.tipoPersona === JURIDICA ? 'jurídica' : 'natural'}</p>
      </div>
    ),
  },
  { key: 'numeroDocumento', label: 'Documento' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'estado', label: 'Estado' },
];

const formSections = [
  {
    title: 'Tipo de persona',
    fields: [
      {
        key: 'tipoPersona',
        label: '¿El proveedor es persona natural o jurídica?',
        type: 'select',
        required: true,
        span: 2,
        options: [NATURAL, JURIDICA],
        hint: 'Natural: una persona con su cédula. Jurídica: una empresa con NIT.',
      },
    ],
  },
  {
    title: 'Identificación',
    fields: [
      // Persona natural
      { key: 'nombreRazonSocial', label: 'Nombre completo', required: true, span: 2, soloSi: (v) => !esJuridica(v) },
      {
        key: 'tipoDocumento',
        label: 'Tipo de documento',
        type: 'select',
        required: true,
        options: tiposDocumento,
        soloSi: (v) => !esJuridica(v),
      },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'documento', required: true, soloSi: (v) => !esJuridica(v) },
      // Persona jurídica: siempre con NIT
      { key: 'nombreRazonSocial', label: 'Razón social', required: true, span: 2, soloSi: esJuridica },
      {
        key: 'numeroDocumento',
        label: 'NIT',
        required: true,
        span: 2,
        placeholder: '900123456-7',
        soloSi: esJuridica,
        validar: (v) => (v && !/^\d{9,10}(-\d)?$/.test(String(v).trim()) ? 'El NIT tiene 9 o 10 dígitos (con guion y dígito de verificación opcional)' : ''),
      },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      { key: 'contacto', label: 'Persona de contacto (opcional)', soloSi: (v) => !esJuridica(v) },
      { key: 'contacto', label: 'Persona de contacto en la empresa', required: true, soloSi: esJuridica },
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
          { key: 'tipoPersona', label: 'Tipo de persona', options: [NATURAL, JURIDICA] },
          { key: 'nombreRazonSocial', label: 'Nombre o razón social' },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
    </div>
  );
}
