import { noEncontrado } from '../errores.js';
import { enviarDato, enviarLista, enviarSinContenido } from '../views/respuesta.view.js';

/**
 * Controlador genérico de catálogos.
 *
 * `crearControladorCatalogo(modelo, que)` devuelve las funciones que
 * atienden cada ruta del catálogo. `que` es el nombre para los mensajes
 * ("La categoría", "El cliente").
 */
export function crearControladorCatalogo(modelo, que) {
  return {
    /** GET / */
    async listar(req, res) {
      const { q, pagina, porPagina, activo } = req.validado.query;
      const { filas, total } = await modelo.listar({
        q,
        pagina,
        porPagina,
        activo: activo === undefined ? undefined : activo === 'true',
      });
      enviarLista(res, { filas, total, pagina, porPagina });
    },

    /** GET /:id */
    async obtener(req, res) {
      const registro = await modelo.buscarPorId(req.validado.params.id);
      if (!registro) throw noEncontrado(que);
      enviarDato(res, registro);
    },

    /** POST / */
    async crear(req, res) {
      enviarDato(res, await modelo.crear(req.validado.body), 201);
    },

    /** PUT /:id */
    async actualizar(req, res) {
      const registro = await modelo.actualizar(req.validado.params.id, req.validado.body);
      if (!registro) throw noEncontrado(que);
      enviarDato(res, registro);
    },

    /** PATCH /:id/estado */
    async cambiarEstado(req, res) {
      const registro = await modelo.cambiarActivo(req.validado.params.id, req.validado.body.activo);
      if (!registro) throw noEncontrado(que);
      enviarDato(res, registro);
    },

    /** DELETE /:id */
    async eliminar(req, res) {
      if (!(await modelo.eliminar(req.validado.params.id))) throw noEncontrado(que);
      enviarSinContenido(res);
    },
  };
}
