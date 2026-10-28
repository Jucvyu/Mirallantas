import { enTransaccion } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import * as rolesModel from '../models/roles.model.js';
import { enviarDato, enviarSinContenido, enviarTodo } from '../views/respuesta.view.js';

/**
 * Controlador de roles y permisos.
 *
 * Cada rol tiene módulos (nivel 2) y, en cada módulo, privilegios para
 * crear, editar y eliminar (nivel 3; ver es tener el módulo).
 *
 * Protege dos roles del sistema: el Administrador no se edita ni se
 * elimina (siempre tiene todos los permisos y privilegios; la base de datos
 * también lo garantiza con triggers) y el Cliente no se elimina.
 */

/**
 * Valida que existan los módulos marcados y los asigna al rol con sus
 * privilegios (nivel 3). `privilegios` = { Clientes: { crear, editar, eliminar } };
 * un módulo sin privilegios indicados queda con todos.
 */
async function asignarPermisos(db, rolId, modulos, privilegios = {}) {
  const permisos = await rolesModel.permisosPorModulo(db, modulos);
  if (permisos.length !== new Set(modulos).size) throw new HttpError(422, 'Alguno de los módulos marcados no existe.');
  await rolesModel.reemplazarPermisos(
    db,
    rolId,
    permisos.map((p) => ({ id: p.id, ...privilegios[p.modulo] })),
  );
}

/** GET /roles */
export async function listar(req, res) {
  enviarTodo(res, await rolesModel.listar());
}

/** GET /roles/permisos */
export async function listarPermisos(req, res) {
  enviarTodo(res, await rolesModel.listarPermisos());
}

/** POST /roles */
export async function crear(req, res) {
  const rol = req.validado.body;
  const id = await enTransaccion(async (db) => {
    const nuevoId = await rolesModel.crear(db, rol);
    await asignarPermisos(db, nuevoId, rol.permisos, rol.privilegios);
    return nuevoId;
  });
  enviarDato(res, await rolesModel.buscarPorId(id), 201);
}

/** PUT /roles/:id */
export async function actualizar(req, res) {
  const { id } = req.validado.params;
  const cambios = req.validado.body;
  const actual = await rolesModel.buscarPorId(id);
  if (!actual) throw noEncontrado('El rol');

  if (actual.nombre === rolesModel.ROL_ADMIN) {
    throw new HttpError(422, 'El rol Administrador es del sistema: no se puede editar.');
  }
  // Nadie más puede llamarse como los roles del sistema
  if (cambios.nombre && [rolesModel.ROL_ADMIN, rolesModel.ROL_CLIENTE].includes(cambios.nombre) && cambios.nombre !== actual.nombre) {
    throw new HttpError(409, 'Ya existe un rol con ese nombre.');
  }

  await enTransaccion(async (db) => {
    await rolesModel.actualizar(db, id, cambios);
    if (cambios.permisos) await asignarPermisos(db, id, cambios.permisos, cambios.privilegios);
  });
  enviarDato(res, await rolesModel.buscarPorId(id));
}

/** DELETE /roles/:id */
export async function eliminar(req, res) {
  const actual = await rolesModel.buscarPorId(req.validado.params.id);
  if (!actual) throw noEncontrado('El rol');
  if ([rolesModel.ROL_ADMIN, rolesModel.ROL_CLIENTE].includes(actual.nombre)) {
    throw new HttpError(422, `El rol ${actual.nombre} es del sistema: no se puede eliminar.`);
  }
  await rolesModel.eliminar(actual.id);
  enviarSinContenido(res);
}
