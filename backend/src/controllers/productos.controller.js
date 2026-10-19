import { enTransaccion } from '../db.js';
import { noEncontrado } from '../errores.js';
import { clienteDeSesion } from '../middleware/auth.js';
import { aPares } from '../models/listado.model.js';
import * as productosModel from '../models/productos.model.js';
import { enviarCatalogo, enviarProducto } from '../views/productos.view.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador de productos.
 *
 * El código todavía lo escribe el asesor al crear. Está pendiente decidir
 * el formato del código automático (ML-000123 o ML-19565R15-0003); cuando
 * se decida, se generará aquí, en el servidor. Una vez asignado, el código
 * no se puede cambiar.
 */

/** GET /productos — el portal solo ve los activos, pida lo que pida. */
export async function listar(req, res) {
  const filtros = req.validado.query;
  const esCliente = Boolean(clienteDeSesion(req));
  const resultado = await productosModel.listar({
    ...filtros,
    activo: filtros.activo === undefined ? undefined : filtros.activo === 'true',
    soloActivos: esCliente,
  });
  enviarCatalogo(res, { ...resultado, pagina: filtros.pagina, porPagina: filtros.porPagina }, esCliente);
}

/** GET /productos/:id — con sus imágenes. */
export async function obtener(req, res) {
  const esCliente = Boolean(clienteDeSesion(req));
  const producto = await productosModel.buscarPorId(req.validado.params.id);
  if (!producto || (esCliente && !producto.activo)) throw noEncontrado('El producto');

  const imagenes = await productosModel.imagenes(producto.id);
  enviarProducto(res, { ...producto, imagenes }, esCliente);
}

/** POST /productos */
export async function crear(req, res) {
  const { foto, ...producto } = req.validado.body;
  await exigirActivo('categoria', producto.categoriaId);
  await exigirActivo('marca', producto.marcaId);
  const id = await enTransaccion(async (db) => {
    const nuevoId = await productosModel.crear(db, producto);
    await productosModel.guardarFoto(db, nuevoId, foto);
    return nuevoId;
  });
  enviarProducto(res, await productosModel.buscarPorId(id), false, 201);
}

/** PUT /productos/:id — también activa o desactiva. */
export async function actualizar(req, res) {
  const { foto, ...cambios } = req.validado.body;
  const { id } = req.validado.params;
  const actual = await productosModel.buscarPorId(id);
  if (!actual) throw noEncontrado('El producto');
  // Solo se revisan la categoría y la marca si se cambian
  if (cambios.categoriaId !== undefined && cambios.categoriaId !== actual.categoriaId) {
    await exigirActivo('categoria', cambios.categoriaId);
  }
  if (cambios.marcaId !== undefined && cambios.marcaId !== actual.marcaId) await exigirActivo('marca', cambios.marcaId);

  await enTransaccion(async (db) => {
    await productosModel.actualizar(db, id, aPares(cambios, productosModel.COLUMNAS_EDITABLES));
    await productosModel.guardarFoto(db, id, foto);
  });
  enviarProducto(res, await productosModel.buscarPorId(id));
}
