import { enTransaccion } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { aPares } from '../models/listado.model.js';
import * as modelosModel from '../models/modelos.model.js';
import * as productosModel from '../models/productos.model.js';
import { enviarModelo, enviarModelos } from '../views/modelos.view.js';
import { enviarProducto } from '../views/productos.view.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador de los modelos de llanta (/api/modelos), para el panel admin.
 *
 * Un modelo es la llanta (marca, nombre, categoría, ficha técnica y foto) y
 * sus referencias son las medidas que se venden (filas de `producto`, con su
 * código ML-…). Lo que se cambia en el modelo la base lo copia a todas sus
 * referencias. El precio no se maneja aquí: se define en cada cotización.
 */

/** GET /modelos */
export async function listar(req, res) {
  const filtros = req.validado.query;
  const resultado = await modelosModel.listar({
    ...filtros,
    activo: filtros.activo === undefined ? undefined : filtros.activo === 'true',
  });
  enviarModelos(res, { ...resultado, pagina: filtros.pagina, porPagina: filtros.porPagina });
}

/** Modelo con sus referencias y sus fotos, o 404. */
async function completo(id, db) {
  const modelo = await modelosModel.buscarPorId(id, db);
  if (!modelo) throw noEncontrado('El producto');
  const [referencias, imagenes] = await Promise.all([productosModel.deModelo(id, db), modelosModel.imagenes(id, db)]);
  return { ...modelo, referencias, imagenes };
}

/** GET /modelos/:id — con sus referencias (medidas) e imágenes. */
export async function obtener(req, res) {
  enviarModelo(res, await completo(req.validado.params.id));
}

/** POST /modelos — el modelo con su ficha, su foto y sus primeras medidas, todo o nada. */
export async function crear(req, res) {
  const { foto, referencias = [], ...modelo } = req.validado.body;
  await exigirActivo('categoria', modelo.categoriaId);
  await exigirActivo('marca', modelo.marcaId);
  const repetida = medidaRepetida(referencias);
  if (repetida) throw new HttpError(422, `La medida ${repetida} está repetida.`);

  const id = await enTransaccion(async (db) => {
    const nuevoId = await modelosModel.crear(db, modelo);
    await modelosModel.guardarFoto(db, nuevoId, foto);
    for (const referencia of referencias) await productosModel.crear(db, { ...referencia, modeloId: nuevoId });
    return nuevoId;
  });
  enviarModelo(res, await completo(id), 201);
}

/** ¿Dos medidas iguales (mismo índice de carga y posición) en la misma petición? */
function medidaRepetida(referencias) {
  const vistas = new Set();
  for (const r of referencias) {
    const clave = `${r.medidas}|${r.indiceCarga ?? ''}|${r.posicion ?? ''}`;
    if (vistas.has(clave)) return r.medidas;
    vistas.add(clave);
  }
  return null;
}

/** PUT /modelos/:id — los cambios pasan a todas sus referencias. */
export async function actualizar(req, res) {
  const { foto, ...cambios } = req.validado.body;
  const { id } = req.validado.params;
  const actual = await modelosModel.buscarPorId(id);
  if (!actual) throw noEncontrado('El producto');
  if (actual.deReencauchadas && ['nombre', 'categoriaId', 'marcaId'].some((c) => c in cambios && cambios[c] !== actual[c])) {
    throw new HttpError(422, 'Las llantas reencauchadas conservan su nombre, marca y categoría.');
  }
  // Solo se revisan la categoría y la marca si se cambian
  if (cambios.categoriaId !== undefined && cambios.categoriaId !== actual.categoriaId) {
    await exigirActivo('categoria', cambios.categoriaId);
  }
  if (cambios.marcaId !== undefined && cambios.marcaId !== actual.marcaId) await exigirActivo('marca', cambios.marcaId);
  // Activar un modelo de una categoría inactiva no tiene sentido: no se vería
  if (cambios.activo && !actual.activo) await exigirActivo('categoria', cambios.categoriaId ?? actual.categoriaId);

  await enTransaccion(async (db) => {
    await modelosModel.actualizar(db, id, aPares(cambios, modelosModel.COLUMNAS));
    await modelosModel.guardarFoto(db, id, foto);
  });
  enviarModelo(res, await completo(id));
}

/** PATCH /modelos/:id/estado — activa o desactiva el modelo (todas sus medidas dejan de ofrecerse). */
export async function cambiarEstado(req, res) {
  const { id } = req.validado.params;
  const { activo } = req.validado.body;
  const actual = await modelosModel.buscarPorId(id);
  if (!actual) throw noEncontrado('El producto');
  if (activo && !actual.activo) await exigirActivo('categoria', actual.categoriaId);
  await enTransaccion((db) => modelosModel.actualizar(db, id, [['activo', activo]]));
  enviarModelo(res, await completo(id));
}

/** Referencia del modelo, o 404 (también si es de otro modelo). */
async function referenciaDelModelo(db, id, referenciaId) {
  const referencia = await modelosModel.referenciaDe(db, id, referenciaId);
  if (!referencia) throw noEncontrado('La medida');
  return referencia;
}

/** POST /modelos/:id/referencias — una medida nueva del modelo. */
export async function crearReferencia(req, res) {
  const { id } = req.validado.params;
  const modelo = await modelosModel.buscarPorId(id);
  if (!modelo) throw noEncontrado('El producto');
  if (modelo.deReencauchadas) {
    throw new HttpError(422, 'Las llantas reencauchadas entran al catálogo solas, desde el reencauche.');
  }
  const nuevaId = await enTransaccion((db) => productosModel.crear(db, { ...req.validado.body, modeloId: id }));
  enviarProducto(res, await productosModel.buscarPorId(nuevaId), 201);
}

/** PUT /modelos/:id/referencias/:referenciaId — edita la medida (o la activa / desactiva). */
export async function actualizarReferencia(req, res) {
  const { id, referenciaId } = req.validado.params;
  const cambios = req.validado.body;
  await enTransaccion(async (db) => {
    const referencia = await referenciaDelModelo(db, id, referenciaId);
    // La llanta reencauchada se maneja desde su producto (precio fijo y unidad única)
    if (referencia.reencauchada) {
      throw new HttpError(422, 'La llanta reencauchada se edita desde su producto, con su precio de venta.');
    }
    await productosModel.actualizar(db, referenciaId, aPares(cambios, productosModel.COLUMNAS_REFERENCIA));
  });
  enviarProducto(res, await productosModel.buscarPorId(referenciaId));
}

/** PATCH /modelos/:id/referencias/:referenciaId/estado — activa o desactiva una medida. */
export async function cambiarEstadoReferencia(req, res) {
  const { id, referenciaId } = req.validado.params;
  const { activo } = req.validado.body;
  await enTransaccion(async (db) => {
    const referencia = await referenciaDelModelo(db, id, referenciaId);
    if (referencia.reencauchada) {
      throw new HttpError(422, 'La llanta reencauchada se activa desde su producto, con su precio de venta.');
    }
    await productosModel.actualizar(db, referenciaId, [['activo', activo]]);
  });
  enviarProducto(res, await productosModel.buscarPorId(referenciaId));
}
