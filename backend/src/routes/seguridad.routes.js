import { Router } from 'express';
import * as roles from '../controllers/roles.controller.js';
import * as usuarios from '../controllers/usuarios.controller.js';
import { autenticar, requierePermiso, soloAdministrador } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { esquemaId, esquemaListado } from '../validators/comunes.validator.js';
import { esquemaEdicionUsuario, esquemaNuevoUsuario, esquemaRol } from '../validators/seguridad.validator.js';

/**
 * Rutas de seguridad: roles (/api/roles) y usuarios (/api/usuarios).
 * Además del permiso, exigen el rol Administrador: quien maneja roles y
 * usuarios controla todo el sistema.
 */

// ---- Roles y permisos ------------------------------------------------------
export const rutasRoles = Router();
rutasRoles.use(autenticar, soloAdministrador, requierePermiso('Roles'));

rutasRoles.get('/', roles.listar);
rutasRoles.get('/permisos', roles.listarPermisos);
rutasRoles.post('/', validar(esquemaRol), roles.crear);
rutasRoles.put('/:id', validar(esquemaId, 'params'), validar(esquemaRol.partial()), roles.actualizar);
rutasRoles.delete('/:id', validar(esquemaId, 'params'), roles.eliminar);

// ---- Usuarios -----------------------------------------------------------------
export const rutasUsuarios = Router();
rutasUsuarios.use(autenticar, soloAdministrador, requierePermiso('Usuarios'));

rutasUsuarios.get('/', validar(esquemaListado, 'query'), usuarios.listar);
rutasUsuarios.post('/', validar(esquemaNuevoUsuario), usuarios.crear);
rutasUsuarios.put('/:id', validar(esquemaId, 'params'), validar(esquemaEdicionUsuario), usuarios.actualizar);
rutasUsuarios.delete('/:id', validar(esquemaId, 'params'), usuarios.eliminar);

