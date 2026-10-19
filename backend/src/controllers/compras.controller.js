import { enTransaccion } from '../db.js';
import { HttpError } from '../errores.js';
import * as comprasModel from '../models/compras.model.js';
import { validarTransicion } from '../reglas.js';
import { enviarDocumento, enviarDocumentos } from '../views/documentos.view.js';
import { exigirActivo } from './estados.js';
import { ingresarCompra } from './inventario.js';

/**
 * Controlador de compras al proveedor (solo personal interno).
 *
 * La compra parte de una cotización de origen: trae sus productos y el
 * asesor puede sumar productos adicionales. El precio de cada línea es el
 * acordado en esta compra y queda guardado aunque el producto cambie.
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

/** POST /compras */
export async function crear(req, res) {
  const datos = req.validado.body;

  const numero = await enTransaccion(async (db) => {
    if (!(await comprasModel.proveedorActivo(db, datos.proveedorId))) {
      throw new HttpError(422, 'El proveedor no existe o está inactivo.');
    }

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

    // No se compran productos que ya no se comercializan
    for (const linea of datos.lineas) await exigirActivo('producto', linea.productoId, db);

    // El total lo calcula el servidor con los precios de cada línea
    const total = datos.lineas.reduce((suma, l) => suma + l.cantidad * l.precioUnitario, 0);
    const compra = await comprasModel.crear(db, { proveedorId: datos.proveedorId, cotizacionId, total });
    for (const linea of datos.lineas) await comprasModel.crearLinea(db, compra.id, linea);
    return compra.numero;
  });

  enviarDocumento(res, await leerCompleta(numero), false, 201);
}

/** PATCH /compras/:numero — recibir, anular o avanzar la entrega. */
export async function actualizar(req, res) {
  const cambios = req.validado.body;

  await enTransaccion(async (db) => {
    const actual = await comprasModel.buscarPorNumero(req.params.numero, { bloquear: 'c' }, db);

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

    // Recibida y entregada: la mercancía entra al inventario (una sola vez)
    const estado = cambios.estado ?? actual.estado;
    const entrega = cambios.estadoEntrega ?? actual.estadoEntrega;
    if (estado === 'Recibida' && entrega === 'Entregado' && !actual.stockAplicado) {
      await ingresarCompra(db, await comprasModel.lineas(actual.id, db));
      await comprasModel.actualizar(db, actual.id, [['stock_aplicado', true]]);
    }
  });

  enviarDocumento(res, await leerCompleta(req.params.numero));
}
