// =========================================================================
// Capa de servicios (arquitectura orientada a servicios, SOA).
//
// Las pantallas no conocen la API: le piden lo que necesitan a un
// servicio, y el servicio sabe a qué URL llamar, cómo enviar los datos y
// cómo convertir la respuesta.
//
//   Pantalla  →  servicio (este archivo)  →  http.js  →  API  →  PostgreSQL
//
// Se importa siempre desde aquí:
//   import { clientesService } from '../../services';
// =========================================================================

export { authService } from './auth.service';
export { cargarReferencias } from './referencias.service';
export { empresaService } from './empresa.service';
export { rolesService, permisosService, usuariosService } from './seguridad.service';
export {
  categoriasService,
  marcasService,
  tiposVehiculoService,
  serviciosService,
  productosService,
  catalogoPublicoService,
} from './catalogos.service';
export { clientesService, proveedoresService, tercerosService } from './contactos.service';
export { cotizacionesService, ventasService, comprasService } from './operacion.service';
export {
  creditosService,
  abonosService,
  solicitudesCreditoService,
  solicitudesServicioService,
} from './cartera.service';
export { avisosPersonalService, dashboardService, notificacionesService, portalService } from './tableros.service';
export {
  CODIGO_CUENTA_INACTIVA,
  EVENTO_CUENTA_INACTIVA,
  EVENTO_SERVIDOR_CAIDO,
  EVENTO_SESION_EXPIRADA,
  nuevaClaveIdempotencia,
  servidorDisponible,
} from './http';
