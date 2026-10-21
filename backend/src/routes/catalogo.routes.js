import { Router } from 'express';
import * as controlador from '../controllers/productos.controller.js';
import { validar } from '../middleware/validar.js';
import { esquemaFiltros } from '../validators/productos.validator.js';

/**
 * Catálogo público (/api/catalogo), sin sesión: lo consulta el landing.
 *
 *   GET /   productos activos con sus datos públicos (sin precios ni costos)
 *
 * Lo frena el límite general de peticiones por IP de la API.
 */
export const rutasCatalogo = Router();

rutasCatalogo.get('/', validar(esquemaFiltros, 'query'), controlador.catalogoPublico);
