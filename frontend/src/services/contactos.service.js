// =========================================================================
// Servicios de contactos: clientes, proveedores y terceros (reencauchadoras).
// =========================================================================

import { clienteDesdeApi, clienteHaciaApi, empresaExternaDesdeApi, empresaExternaHaciaApi } from './adaptadores';
import { conCambioDeEstado } from './catalogos.service';
import { crearServicio } from './recurso';

export const clientesService = conCambioDeEstado(
  crearServicio({ ruta: '/clientes', desdeApi: clienteDesdeApi, haciaApi: clienteHaciaApi }),
);

export const proveedoresService = conCambioDeEstado(
  crearServicio({ ruta: '/proveedores', desdeApi: empresaExternaDesdeApi, haciaApi: empresaExternaHaciaApi }),
);

export const tercerosService = conCambioDeEstado(
  crearServicio({ ruta: '/terceros', desdeApi: empresaExternaDesdeApi, haciaApi: empresaExternaHaciaApi }),
);
