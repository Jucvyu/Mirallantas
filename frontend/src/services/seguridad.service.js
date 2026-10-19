// =========================================================================
// Servicios de seguridad: roles (con sus permisos) y usuarios.
// =========================================================================

import { activoDesdeEstado, idPorNombre, rolDesdeApi, rolHaciaApi, usuarioDesdeApi } from './adaptadores';
import { traerTodo } from './http';
import { crearServicio } from './recurso';
import { vacioANull } from '../utils/formato';

export const rolesService = crearServicio({ ruta: '/roles', desdeApi: rolDesdeApi, haciaApi: rolHaciaApi });

/** Módulos que se pueden marcar en un rol ("Clientes", "Ventas", "Empresa"…). */
export const permisosService = {
  async listar() {
    return traerTodo('/roles/permisos');
  },
};

/**
 * Valores del formulario de usuario → cuerpo de la API. El rol viaja como
 * id: `contexto.roles` es la lista de roles para encontrarlo por nombre.
 */
function usuarioHaciaApi(v, fila, { roles }) {
  return {
    nombre: v.nombre,
    tipoDocumento: v.tipoDocumento,
    numeroDocumento: String(v.numeroDocumento ?? '').trim(),
    correo: v.correo,
    telefono: vacioANull(v.telefono),
    rolId: idPorNombre(roles, v.rol),
    // Al editar, la contraseña solo se envía si se escribió una nueva
    password: v.password || undefined,
    ...(fila ? { activo: activoDesdeEstado(v.estado) } : {}),
  };
}

const usuariosBase = crearServicio({
  ruta: '/usuarios',
  desdeApi: usuarioDesdeApi,
  haciaApi: usuarioHaciaApi,
});

export const usuariosService = {
  ...usuariosBase,
  /**
   * Activa o desactiva una cuenta desde la tabla. Una cuenta inactiva no
   * puede iniciar sesión: ve el aviso de hablar con el administrador.
   */
  cambiarEstado: (fila, estado) => usuariosBase.enviar(fila, { activo: estado === 'Activo' }, { metodo: 'PUT' }),
};

