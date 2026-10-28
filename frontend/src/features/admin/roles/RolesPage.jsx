import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { GRUPOS_MODULOS } from '../../../permisos';
import { useRecurso } from '../../../hooks/useRecurso';
import { permisosService, rolesService } from '../../../services';

// Roles y permisos. Al crear un rol se marcan los módulos a los que
// tendrá acceso y, en cada uno, qué puede hacer (nivel 3 de seguridad:
// ver, crear, editar y eliminar). La lista de módulos sale de la tabla `permiso`.
const columns = [
  { key: 'nombre', label: 'Rol' },
  { key: 'descripcion', label: 'Descripción' },
  {
    key: 'permisos',
    label: 'Permisos',
    render: (row) => `${String(row.permisos ?? '').split(',').filter(Boolean).length} módulos`,
    exportar: (row) => row.permisos,
  },
  { key: 'estado', label: 'Estado' },
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
          key: 'accesos',
          label: 'Módulos y privilegios',
          type: 'privilegios',
          span: 2,
          required: true,
          options: modulos,
          // Los módulos se muestran por categoría (Configuración, Catálogo…)
          grupos: GRUPOS_MODULOS,
          hint: 'Marca los módulos que el rol verá en el menú y, en cada uno, desactiva las acciones que no podrá hacer.',
          validar: (valor) =>
            Object.values(valor ?? {}).some((a) => a.ver) ? '' : 'Marca al menos un módulo que el rol pueda ver.',
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
        // Desactivar un rol deja sin acceso a sus usuarios; el Administrador no se desactiva
        statusKey="estado"
        statusVariant="switch"
        statusOptions={estadosActivo}
        onStatusChange={(fila, estado) => roles.ejecutar(() => rolesService.cambiarEstado(fila, estado))}
        canChangeStatus={(rol) => rol.nombre !== ROL_ADMIN}
        canDelete={(rol) => ![ROL_ADMIN, 'Cliente'].includes(rol.nombre)}
        newLabel="Nuevo rol"
        formSections={seccionesFormulario(permisos.filas.map((p) => p.modulo))}
        entityName="rol"
        filters={[{ key: 'estado', label: 'Estado', options: estadosActivo }]}
      />
    </div>
  );
}
