import { enTransaccion } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { origen } from '../middleware/auth.js';
import * as eventos from '../models/eventos.model.js';
import { cifrarPassword } from '../utils/contrasenas.js';
import * as clientesModel from '../models/clientes.model.js';
import { aPares } from '../models/listado.model.js';
import * as rolesModel from '../models/roles.model.js';
import * as usuariosModel from '../models/usuarios.model.js';
import { enviarLista, enviarSinContenido } from '../views/respuesta.view.js';
import { enviarUsuario } from '../views/usuarios.view.js';

/**
 * Controlador de usuarios (cuentas de acceso).
 *
 * Una cuenta con rol "Cliente" queda ligada a una ficha de cliente: si ya
 * existe un cliente con el mismo documento se usa ese; si no, se crea.
 *
 * Solo el Administrador entra a este módulo (ver seguridad.routes.js).
 * Nadie puede desactivarse ni eliminarse a sí mismo, y el sistema nunca se
 * queda sin un Administrador activo.
 */

/** Impide dejar el sistema sin ningún Administrador activo. */
async function exigirOtroAdministrador(db, usuario) {
  if (usuario.rol === rolesModel.ROL_ADMIN && (await usuariosModel.contarAdministradores(db, usuario.id)) === 0) {
    throw new HttpError(422, 'Debe quedar al menos un Administrador activo.');
  }
}

/** Deja en la bitácora un cambio hecho sobre otra cuenta. */
const registrarCambio = (req, tipo, usuario, detalle) =>
  eventos.registrar({
    tipo,
    gravedad: 'Alerta',
    usuarioId: req.usuario.id,
    correo: req.usuario.correo,
    ...origen(req),
    detalle: `${usuario.correo}${detalle ? ` · ${detalle}` : ''}`,
  });

/**
 * Un correo, documento o teléfono no puede repetirse entre cuentas. El
 * mensaje NO dice cuál dato se repite: así nadie puede averiguar qué
 * correos o documentos están registrados.
 */
async function exigirDatosNuevos(db, datos, mensaje, excluirId = null) {
  await usuariosModel.bloquearDatosUnicos(db);
  if (await usuariosModel.datoRepetido(db, datos, excluirId)) throw new HttpError(409, mensaje);
}

/** El primer Administrador creado no se desactiva, no cambia de rol ni se elimina. */
async function protegerPrincipal(db, id, accion) {
  if (id === (await usuariosModel.idPrimerAdministrador(db))) {
    throw new HttpError(422, `El administrador principal del aplicativo no se puede ${accion}.`);
  }
}

/** ¿El rol indicado es el de clientes del portal? */
async function esRolCliente(db, rolId) {
  const nombre = await rolesModel.nombrePorId(db, rolId);
  if (!nombre) throw new HttpError(422, 'El rol no existe.');
  return nombre === rolesModel.ROL_CLIENTE;
}

/** Cliente para una cuenta del portal: el existente con ese documento o uno nuevo. */
async function clienteParaCuenta(db, datos) {
  const existente = await clientesModel.idPorDocumento(db, datos.tipoDocumento, datos.numeroDocumento);
  return existente ?? clientesModel.crear(db, datos);
}

/** GET /usuarios */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const { filas, total } = await usuariosModel.listar(req.validado.query);
  enviarLista(res, { filas, total, pagina, porPagina });
}

/** POST /usuarios */
export async function crear(req, res) {
  const u = req.validado.body;
  const id = await enTransaccion(async (db) => {
    await exigirDatosNuevos(db, u, 'No pudimos crear el usuario. Revisa los datos e inténtalo de nuevo.');
    const clienteId = (await esRolCliente(db, u.rolId)) ? await clienteParaCuenta(db, u) : null;
    return usuariosModel.crear(db, { ...u, passwordHash: await cifrarPassword(u.password), clienteId });
  });
  const creado = await usuariosModel.buscarPorId(id);
  await registrarCambio(req, 'usuario_creado', creado, `rol ${creado.rol}`);
  enviarUsuario(res, creado, 201);
}

/** PUT /usuarios/:id */
export async function actualizar(req, res) {
  const { id } = req.validado.params;
  const { password, ...cambios } = req.validado.body;
  const actual = await usuariosModel.buscarPorId(id);
  if (!actual) throw noEncontrado('El usuario');
  if (id === req.usuario.id && cambios.activo === false) {
    throw new HttpError(422, 'No puedes desactivar tu propia cuenta.');
  }

  const cambiaRol = cambios.rolId !== undefined && cambios.rolId !== actual.rolId;
  const desactiva = cambios.activo === false && actual.activo;

  await enTransaccion(async (db) => {
    if (desactiva) await protegerPrincipal(db, id, 'desactivar');
    if (cambiaRol) await protegerPrincipal(db, id, 'cambiar de rol');
    if (cambiaRol || desactiva) await exigirOtroAdministrador(db, actual);
    // Correo, documento o teléfono nuevos: no pueden ser los de otra cuenta
    const datosUnicos = { ...actual, ...cambios };
    if (['correo', 'numeroDocumento', 'telefono'].some((c) => cambios[c] !== undefined && cambios[c] !== actual[c])) {
      await exigirDatosNuevos(db, datosUnicos, 'No pudimos guardar los cambios del usuario. Revisa los datos.', id);
    }
    const pares = aPares(cambios, usuariosModel.COLUMNAS);
    // La contraseña solo cambia si se escribió una nueva
    if (password) pares.push(['password_hash', await cifrarPassword(password)]);
    if (cambiaRol) {
      const pasaACliente = await esRolCliente(db, cambios.rolId);
      // Si pasa a rol Cliente, se liga a su ficha de cliente (portal)
      if (pasaACliente && !actual.clienteId) {
        pares.push(['cliente_id', await clienteParaCuenta(db, { ...actual, ...cambios })]);
      }
      // Si deja de ser Cliente (p. ej. lo hacen Administrador), se desliga de
      // la ficha: así entra al panel y ve todo lo que su rol permite, no
      // solo los datos de ese cliente. La ficha de cliente no se borra.
      if (!pasaACliente && actual.clienteId) pares.push(['cliente_id', null]);
    }
    await usuariosModel.actualizar(db, id, pares);
    // Contraseña, rol o estado nuevos: se cierran las sesiones abiertas de esa cuenta
    if (password || cambiaRol || desactiva) await usuariosModel.subirVersionSesion(id, db);
  });

  const actualizado = await usuariosModel.buscarPorId(id);
  if (password || cambiaRol || desactiva) {
    const que = [password && 'contraseña', cambiaRol && `rol ${actualizado.rol}`, desactiva && 'desactivado'];
    await registrarCambio(req, 'usuario_modificado', actualizado, que.filter(Boolean).join(', '));
  }
  enviarUsuario(res, actualizado);
}

/** DELETE /usuarios/:id */
export async function eliminar(req, res) {
  const { id } = req.validado.params;
  if (id === req.usuario.id) throw new HttpError(422, 'No puedes eliminar tu propia cuenta.');
  const actual = await usuariosModel.buscarPorId(id);
  if (!actual) throw noEncontrado('El usuario');
  await enTransaccion(async (db) => {
    await protegerPrincipal(db, id, 'eliminar');
    await exigirOtroAdministrador(db, actual);
    await usuariosModel.eliminar(id, db);
  });
  await registrarCambio(req, 'usuario_eliminado', actual);
  enviarSinContenido(res);
}
