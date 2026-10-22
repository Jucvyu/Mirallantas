import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo, tiposDocumento } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { useAuth } from '../../../context/AuthContext';
import { rolesService, usuariosService } from '../../../services';

// Cuentas de acceso al aplicativo. Una cuenta con rol "Cliente" queda
// ligada a su ficha de cliente (si no existe, la API la crea).
//
// El estado se cambia desde la tabla: una cuenta inactiva no puede iniciar
// sesión (ve el aviso de hablar con el administrador). El administrador
// principal (el primero que se creó) no se desactiva ni se elimina.
const columns = [
  {
    key: 'nombre',
    label: 'Nombre',
    render: (row) => (
      <span className="inline-flex items-center gap-2">
        {row.nombre}
        {row.principal && (
          <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Principal
          </span>
        )}
      </span>
    ),
  },
  { key: 'numeroDocumento', label: 'Documento' },
  { key: 'correo', label: 'Correo' },
  { key: 'rol', label: 'Rol' },
  { key: 'estado', label: 'Estado' },
];

function seccionesFormulario(nombresRoles) {
  return [
    {
      title: 'Datos personales',
      fields: [
        { key: 'nombre', label: 'Nombre completo', required: true, span: 2 },
        { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: tiposDocumento },
        { key: 'numeroDocumento', label: 'Número de documento', type: 'number', required: true },
        { key: 'correo', label: 'Correo electrónico', type: 'email', required: true },
        { key: 'telefono', label: 'Teléfono', type: 'tel' },
      ],
    },
    {
      title: 'Acceso al sistema',
      fields: [
        {
          key: 'rol',
          label: 'Rol',
          // Buscador del rol (relación con la tabla rol; el nombre es único)
          type: 'buscador',
          required: true,
          options: nombresRoles,
          emptyLabel: 'rol',
          hint: 'El rol define a qué módulos entra la cuenta.',
        },
        {
          key: 'password',
          label: 'Contraseña',
          type: 'password',
          span: 2,
          only: 'create',
          required: true,
          hint: 'Mínimo 10 caracteres, con letras y números.',
        },
        {
          key: 'password',
          label: 'Nueva contraseña',
          type: 'password',
          span: 2,
          only: 'edit',
          placeholder: 'Déjala vacía para no cambiarla',
        },
      ],
    },
  ];
}

export default function UsuariosPage() {
  const roles = useRecurso(rolesService);
  const usuarios = useRecurso(usuariosService);
  // El servicio necesita la lista de roles para enviar el rol como id
  const contexto = { roles: roles.filas };
  const nombresRoles = roles.filas.filter((r) => r.activo).map((r) => r.nombre);
  const { usuario: yo } = useAuth();
  // Ni el administrador principal ni uno mismo se desactivan o eliminan
  const protegido = (fila) => fila.principal || fila.id === yo?.id;

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Usuarios']} />
      <DataTable
        title="Usuarios"
        columns={columns}
        data={usuarios.filas}
        cargando={usuarios.cargando}
        error={usuarios.error}
        onRecargar={usuarios.recargar}
        onCreate={(valores) => usuarios.crear(valores, contexto)}
        onEdit={(fila, valores) => usuarios.editar(fila, valores, contexto)}
        onDelete={usuarios.eliminar}
        canDelete={(fila) => !protegido(fila)}
        statusKey="estado"
        statusVariant="switch"
        statusOptions={estadosActivo}
        onStatusChange={(fila, estado) => usuarios.ejecutar(() => usuariosService.cambiarEstado(fila, estado))}
        canChangeStatus={(fila) => !protegido(fila)}
        newLabel="Nuevo usuario"
        formSections={seccionesFormulario(nombresRoles)}
        entityName="usuario"
        filters={[
          { key: 'rol', label: 'Rol', options: nombresRoles },
          { key: 'estado', label: 'Estado', options: estadosActivo },
        ]}
      />
    </div>
  );
}
