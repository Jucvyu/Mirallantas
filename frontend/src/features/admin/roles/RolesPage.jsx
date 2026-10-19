import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { GRUPOS_MODULOS } from '../../../permisos';
import { useRecurso } from '../../../hooks/useRecurso';
import { permisosService, rolesService } from '../../../services';

// Roles y permisos. Al crear un rol se marcan los módulos a los que
// tendrá acceso; la lista de módulos sale de la tabla `permiso`.
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'nombre', label: 'Rol' },
  { key: 'descripcion', label: 'Descripción' },
  {
    key: 'permisos',
    label: 'Permisos',
    render: (row) => `${String(row.permisos ?? '').split(',').filter(Boolean).length} módulos`,
  },
];

function seccionesFormulario(modulos) {
  return [
    {
      title: 'Datos del rol',
      fields: [
        { key: 'nombre', label: 'Nombre del rol', required: true, span: 2, placeholder: 'Asesor de ventas' },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', span: 2 },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosActivo, only: ['edit', 'view'] },
      ],
    },
    {
      title: 'Permisos',
      fields: [
        {
          key: 'permisos',
          label: 'Módulos a los que accede',
          type: 'checkboxes',
          span: 2,
          required: true,
          options: modulos,
          // Los módulos se muestran por categoría (Configuración, Catálogo…)
          grupos: GRUPOS_MODULOS,
          hint: 'El rol solo verá en el menú los módulos marcados.',
        },
      ],
    },
  ];
}

/** Rol del sistema con todos los permisos. */
const ROL_ADMIN = 'Administrador';

export default function RolesPage() {
  const roles = useRecurso(rolesService);
  // Módulos disponibles para marcar (Clientes, Ventas, Empresa…)
  const permisos = useRecurso(permisosService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Roles']} />
      <DataTable
        title="Roles y permisos"
        columns={columns}
        data={roles.filas}
        cargando={roles.cargando}
        error={roles.error}
        onRecargar={roles.recargar}
        onCreate={roles.crear}
        onEdit={roles.editar}
        onDelete={roles.eliminar}
        // Roles del sistema: el Administrador no se edita ni se elimina y el
        // Cliente no se elimina (la API también lo impide)
        canEdit={(rol) => rol.nombre !== ROL_ADMIN}
        canDelete={(rol) => ![ROL_ADMIN, 'Cliente'].includes(rol.nombre)}
        newLabel="Nuevo rol"
        formSections={seccionesFormulario(permisos.filas.map((p) => p.modulo))}
        entityName="rol"
        filters={[{ key: 'estado', label: 'Estado', options: estadosActivo }]}
      />
    </div>
  );
}
