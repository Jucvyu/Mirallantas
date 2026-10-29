// =========================================================================
// Servicios de contactos: clientes, proveedores y terceros (reencauchadoras).
// =========================================================================

import { api } from './http';
import { clienteDesdeApi, clienteHaciaApi, empresaExternaDesdeApi, empresaExternaHaciaApi } from './adaptadores';
import { conCambioDeEstado } from './catalogos.service';
import { crearServicio } from './recurso';

export const clientesService = conCambioDeEstado(
  crearServicio({ ruta: '/clientes', desdeApi: clienteDesdeApi, haciaApi: clienteHaciaApi }),
);

/**
 * Clientes que se pueden elegir en los formularios (Ventas, Abonos, Pedidos,
 * solicitudes): solo los que tienen cuenta de usuario con rol Cliente. Es de
 * solo lectura (no crea ni edita); las fichas se gestionan desde Usuarios.
 */
export const clientesSeleccionablesService = {
  ruta: '/seleccion/clientes',
  async listar() {
    const { datos } = await api('/seleccion/clientes');
    return datos;
  },
};

export const proveedoresService = conCambioDeEstado(
  crearServicio({ ruta: '/proveedores', desdeApi: empresaExternaDesdeApi, haciaApi: empresaExternaHaciaApi }),
);

export const tercerosService = conCambioDeEstado(
  crearServicio({ ruta: '/terceros', desdeApi: empresaExternaDesdeApi, haciaApi: empresaExternaHaciaApi }),
);
