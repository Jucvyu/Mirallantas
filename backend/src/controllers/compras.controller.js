import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import * as comprasModel from '../models/compras.model.js';
import { validarTransicion } from '../reglas.js';
import { enviarDocumento, enviarDocumentos } from '../views/documentos.view.js';
import * as productosModel from '../models/productos.model.js';
import { exigirActivo } from './estados.js';

/**
 * Controlador de compras al proveedor (solo personal interno).
 *
 * La compra parte de una cotización de origen: trae sus productos y el
 * asesor puede sumar productos adicionales, con su proveedor y su precio de
 * compra (obligatorios). El precio de cada línea es el
 * acordado en esta compra y queda guardado aunque el producto cambie. Cada
 * línea muestra si su costo se confirmó con el proveedor en la cotización.
 *
 * El aplicativo no maneja stock: recibir una compra no mueve existencias;
 * solo actualiza el último costo de compra de cada llanta (dato interno).
 */

/**
 * Estados de la cotización desde los que se puede comprar. Es la regla que
 * ya usaba el frontend. Pendiente de confirmar: el prompt maestro propone
 * dejar solo "Aprobada" (y vigente).
 */
const ESTADOS_ABASTECIBLES = ['Aprobada', 'En proceso'];

/** Compra completa (cabecera + líneas). */
async function leerCompleta(numero) {
  const compra = await comprasModel.buscarPorNumero(numero);
  return { ...compra, detalle: await comprasModel.lineas(compra.id) };
}

/** GET /compras */
export async function listar(req, res) {
  const { pagina, porPagina } = req.validado.query;
  const resultado = await comprasModel.listar(req.validado.query);
  enviarDocumentos(res, { ...resultado, pagina, porPagina });
}

/** GET /compras/:numero */
export async function obtener(req, res) {
  enviarDocumento(res, await leerCompleta(req.params.numero));
}

/**
 * Revisa las líneas que llegan del formulario: productos activos, proveedor
 * activo y, en las llantas de la cotización, el proveedor con el que se
 * verificaron. Devuelve las líneas listas para guardar.
 */
async function prepararLineas(db, lineasNuevas, cotizacionId) {
  // No se compran productos que ya no se comercializan, ni a un proveedor inactivo
  for (const linea of lineasNuevas) {
    await exigirActivo('producto', linea.productoId, db);
    if (linea.proveedorId && !(await comprasModel.proveedorActivo(db, linea.proveedorId))) {
      throw new HttpError(422, 'El proveedor elegido no existe o está inactivo.');
    }
  }
  const deLaCotizacion = cotizacionId ? await comprasModel.lineasParaComprar(db, cotizacionId) : [];
  return lineasNuevas.map((l) =>
    l.origen === 'Cotización'
      ? { ...l, proveedorId: deLaCotizacion.find((c) => c.productoId === l.productoId)?.proveedorId ?? null }
      : l,
  );
}

/** POST /compras */
export async function crear(req, res) {
  const datos = req.validado.body;

  const numero = await enTransaccion(async (db) => {
    // La cotización se vuelve a validar aquí, bloqueada, por si cambió de
    // estado mientras el asesor llenaba el formulario.
    let cotizacionId = null;
    if (datos.cotizacion) {
      const cotizacion = await comprasModel.cotizacionBloqueada(db, datos.cotizacion);
      if (!cotizacion) throw new HttpError(422, `La cotización ${datos.cotizacion} no existe.`);
      if (!ESTADOS_ABASTECIBLES.includes(cotizacion.estado)) {
        throw new HttpError(422, `La cotización ${datos.cotizacion} está "${cotizacion.estado}": no se puede abastecer.`);
      }
      cotizacionId = cotizacion.id;
    }

    const lineas = await prepararLineas(db, datos.lineas, cotizacionId);

    // El total lo calcula el servidor con los precios de cada línea. La
    // cabecera guarda el proveedor solo si todas las líneas son del mismo
    const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
    const compra = await comprasModel.crear(db, { proveedorId: comprasModel.proveedorComun(lineas), cotizacionId, total });
    for (const linea of lineas) await comprasModel.crearLinea(db, compra.id, linea);
    return compra.numero;
  });

  enviarDocumento(res, await leerCompleta(numero), false, 201);
}

/** PATCH /compras/:numero — editar el detalle, recibir, anular o avanzar la entrega. */
export async function actualizar(req, res) {
  const cambios = req.validado.body;

  await enTransaccion(async (db) => {
    const actual = await comprasModel.buscarPorNumero(req.params.numero, { bloquear: 'c' }, db);

    // ---- Detalle: se edita solo con la compra y su entrega pendientes
    if (cambios.lineas) {
      if (actual.estado !== 'Pendiente' || actual.estadoEntrega !== 'Pendiente') {
        throw new HttpError(422, 'El detalle solo se edita con la compra y su entrega en "Pendiente".');
      }
      const lineas = await prepararLineas(db, cambios.lineas, actual.cotizacionId);
      await comprasModel.borrarLineas(db, actual.id);
      for (const linea of lineas) await comprasModel.crearLinea(db, actual.id, linea);
      await comprasModel.actualizar(db, actual.id, [
        ['total', lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0)],
        ['proveedor_id', comprasModel.proveedorComun(lineas)],
      ]);
    }

    if (cambios.estado && cambios.estado !== actual.estado) {
      validarTransicion('compra', actual.estado, cambios.estado);
      await comprasModel.actualizar(db, actual.id, [['estado', cambios.estado]]);
      // Una orden anulada ya no se va a entregar
      if (cambios.estado === 'Anulada' && !['Entregado', 'Cancelado'].includes(actual.estadoEntrega)) {
        await comprasModel.actualizar(db, actual.id, [['estado_entrega', 'Cancelado']]);
        actual.estadoEntrega = 'Cancelado';
      }
    }
    if (cambios.estadoEntrega && cambios.estadoEntrega !== actual.estadoEntrega) {
      validarTransicion('entrega', actual.estadoEntrega, cambios.estadoEntrega);
      await comprasModel.actualizar(db, actual.id, [['estado_entrega', cambios.estadoEntrega]]);
    }

    let estado = cambios.estado ?? actual.estado;
    const entrega = cambios.estadoEntrega ?? actual.estadoEntrega;
    // No se da por recibida mientras su entrega no esté completada
    if (estado === 'Recibida' && actual.estado !== 'Recibida' && entrega !== 'Entregado') {
      throw new HttpError(422, 'La compra se marca como "Recibida" cuando su entrega esté completada ("Entregado").');
    }
    // Con la entrega completada, la compra pendiente pasa sola a "Recibida"
    if (entrega === 'Entregado' && estado === 'Pendiente') {
      await comprasModel.actualizar(db, actual.id, [['estado', 'Recibida']]);
      estado = 'Recibida';
    }

    // Recibida y entregada: se guarda el último costo de compra de cada llanta
    if (estado === 'Recibida' && entrega === 'Entregado') {
      for (const linea of await comprasModel.lineas(actual.id, db)) {
        await productosModel.actualizarPrecioCompra(db, linea.productoId, linea.precioUnitario);
      }
    }
  });

  enviarDocumento(res, await leerCompleta(req.params.numero));
}
