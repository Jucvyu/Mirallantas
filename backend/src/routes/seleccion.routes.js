import { Router } from 'express';
import { autenticar, soloPersonal } from '../middleware/auth.js';
import * as clientesModel from '../models/clientes.model.js';

/**
 * Datos para los selectores de los formularios del personal. Por ahora solo
 * los clientes elegibles (usuarios con rol Cliente). Lo usan Ventas, Abonos,
 * Pedidos-Cotización y las solicitudes, así que no depende del permiso de un
 * módulo en concreto: basta ser personal (no un cliente del portal).
 */
export const rutasSeleccion = Router();

rutasSeleccion.use(autenticar, soloPersonal);

rutasSeleccion.get('/clientes', async (req, res) => {
  res.json({ datos: await clientesModel.seleccionables() });
});
