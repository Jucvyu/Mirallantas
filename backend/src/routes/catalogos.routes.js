import { Router } from 'express';
import { crearControladorCatalogo } from '../controllers/catalogos.controller.js';
import { autenticar, requierePermiso } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import * as modelos from '../models/catalogos.model.js';
import * as esquemas from '../validators/catalogos.validator.js';
import { esquemaId, esquemaListado } from '../validators/comunes.validator.js';

/**
 * Rutas de los catálogos simples. Todos tienen las mismas rutas:
 *
 *   GET    /            listado con búsqueda (?q=), filtro ?activo= y paginación
 *   GET    /:id         un registro
 *   POST   /            crea                     (requiere el permiso del módulo)
 *   PUT    /:id         actualiza parcialmente   (idem)
 *   PATCH  /:id/estado  activa o desactiva       (idem)
 *   DELETE /:id         elimina; 409 si otros registros dependen de él
 *
 * opciones:
 *   modelo        modelo del catálogo (models/catalogos.model.js)
 *   que           nombre en singular para los mensajes ("La categoría")
 *   permiso       permiso que exigen las escrituras
 *   lecturaLibre  si es true, cualquier usuario con sesión puede leer
 *                 (catálogos que también ve el portal del cliente)
 *   esquema       esquema Zod del cuerpo al crear (al editar, su .partial())
 */
function rutasCatalogo({ modelo, que, permiso, lecturaLibre = false, esquema }) {
  const rutas = Router();
  const controlador = crearControladorCatalogo(modelo, que);
  const lectura = lecturaLibre ? [] : [requierePermiso(permiso)];
  const escritura = requierePermiso(permiso);
  const conId = validar(esquemaId, 'params');

  rutas.use(autenticar);
  rutas.get('/', ...lectura, validar(esquemaListado, 'query'), controlador.listar);
  rutas.get('/:id', ...lectura, conId, controlador.obtener);
  rutas.post('/', escritura, validar(esquema), controlador.crear);
  rutas.put('/:id', escritura, conId, validar(esquema.partial()), controlador.actualizar);
  if (modelo.conActivo) {
    rutas.patch('/:id/estado', escritura, conId, validar(esquemas.esquemaEstado), controlador.cambiarEstado);
  }
  rutas.delete('/:id', escritura, conId, controlador.eliminar);
  return rutas;
}

export const rutasCategorias = rutasCatalogo({
  modelo: modelos.categorias,
  que: 'La categoría',
  permiso: 'Categorías',
  lecturaLibre: true,
  esquema: esquemas.esquemaCategoria,
});

export const rutasMarcas = rutasCatalogo({
  modelo: modelos.marcas,
  que: 'La marca',
  permiso: 'Marcas',
  lecturaLibre: true,
  esquema: esquemas.esquemaMarca,
});

export const rutasTiposVehiculo = rutasCatalogo({
  modelo: modelos.tiposVehiculo,
  que: 'El tipo de vehículo',
  permiso: 'Productos',
  lecturaLibre: true,
  esquema: esquemas.esquemaTipoVehiculo,
});

export const rutasServicios = rutasCatalogo({
  modelo: modelos.servicios,
  que: 'El servicio',
  permiso: 'Productos',
  lecturaLibre: true,
  esquema: esquemas.esquemaServicio,
});

export const rutasClientes = rutasCatalogo({
  modelo: modelos.clientes,
  que: 'El cliente',
  permiso: 'Clientes',
  esquema: esquemas.esquemaCliente,
});

export const rutasProveedores = rutasCatalogo({
  modelo: modelos.proveedores,
  que: 'El proveedor',
  permiso: 'Proveedores',
  esquema: esquemas.esquemaEmpresaExterna,
});

export const rutasTerceros = rutasCatalogo({
  modelo: modelos.terceros,
  que: 'El tercero',
  permiso: 'Terceros',
  esquema: esquemas.esquemaEmpresaExterna,
});
