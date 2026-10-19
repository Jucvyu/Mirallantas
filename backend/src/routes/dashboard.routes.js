import { Router } from 'express';
import * as controlador from '../controllers/dashboard.controller.js';
import { autenticar, requierePermiso, soloPersonal } from '../middleware/auth.js';

/**
 * Rutas del tablero (/api/dashboard).
 *
 *   GET /   → { ventasMes, pedidos, reencauchesPorMes, ventasPorMarca, ultimosPedidos }
 */
export const rutasDashboard = Router();
rutasDashboard.use(autenticar, soloPersonal, requierePermiso('Dashboard'));

rutasDashboard.get('/', controlador.obtener);
