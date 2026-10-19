import * as empresaModel from '../models/empresa.model.js';
import { enviarDato } from '../views/respuesta.view.js';

/**
 * Controlador de los datos de la empresa (encabezan los comprobantes).
 * Mientras nadie los registre, la respuesta trae `datos: null`: el
 * sistema nunca inventa un NIT ni una dirección.
 */

/** GET /empresa */
export async function obtener(req, res) {
  enviarDato(res, await empresaModel.obtener());
}

