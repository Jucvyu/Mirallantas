import * as dashboardModel from '../models/dashboard.model.js';
import { enviarTablero } from '../views/dashboard.view.js';

/**
 * Controlador del tablero del administrador. Pide cada indicador al
 * modelo y la vista arma la respuesta.
 */

/** GET /dashboard */
export async function obtener(req, res) {
  enviarTablero(res, {
    ventas: await dashboardModel.ventasDelMes(),
    pedidos: await dashboardModel.pedidos(),
    reencauches: await dashboardModel.reencauchesPorMes(),
    marcas: await dashboardModel.ventasPorMarca(),
    ultimos: await dashboardModel.ultimosPedidos(),
  });
}
