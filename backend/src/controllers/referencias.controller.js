import * as referenciasModel from '../models/referencias.model.js';

/**
 * GET /referencias — listas del sistema para los formularios. Es pública:
 * el registro de clientes (sin sesión) necesita los tipos de documento.
 */
export async function listar(req, res) {
  res.json(await referenciasModel.listar());
}
