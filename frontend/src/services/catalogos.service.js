// =========================================================================
// Servicios del catálogo: categorías, marcas, tipos de vehículo, servicios
// (reencauche) y productos.
// =========================================================================

import {
  activoDesdeEstado,
  categoriaHaciaApi,
  conEstado,
  idPorNombre,
  imagenCambiada,
  marcaHaciaApi,
  productoDesdeApi,
} from './adaptadores';
import { crearServicio } from './recurso';
import { parseCOP, vacioANull } from '../utils/formato';

/**
 * Agrega a un servicio de catálogo la operación "activar / desactivar"
 * (PATCH /ruta/:id/estado), que usan los interruptores de las tablas.
 */
export function conCambioDeEstado(servicio) {
  return {
    ...servicio,
    cambiarEstado: (fila, estado) => servicio.enviar(fila, { activo: estado === 'Activo' }, { sufijo: '/estado' }),
  };
}

export const categoriasService = conCambioDeEstado(
  crearServicio({ ruta: '/categorias', desdeApi: conEstado, haciaApi: categoriaHaciaApi }),
);

export const marcasService = conCambioDeEstado(
  crearServicio({ ruta: '/marcas', desdeApi: conEstado, haciaApi: marcaHaciaApi }),
);

export const tiposVehiculoService = crearServicio({ ruta: '/tipos-vehiculo' });

export const serviciosService = crearServicio({ ruta: '/servicios', desdeApi: conEstado });

// ---- Productos ----------------------------------------------------------------

/**
 * Formulario de producto → cuerpo de la API. `fila` solo existe al editar:
 * entonces no se envía el código (no cambia) y sí el estado. Las listas de
 * `contexto` sirven para convertir los nombres elegidos en ids.
 */
function productoHaciaApi(v, fila, { categorias, marcas, tipos }) {
  return {
    ...(fila ? { activo: activoDesdeEstado(v.estado) } : { codigo: v.codigo }),
    nombre: v.nombre,
    descripcion: vacioANull(v.descripcion),
    categoriaId: idPorNombre(categorias, v.categoria),
    marcaId: idPorNombre(marcas, v.marca),
    medidas: v.medidas,
    tipoVehiculoId: idPorNombre(tipos, v.tipoVehiculo),
    precioVenta: parseCOP(v.precioVenta),
    // La foto solo se envía si cambió (las imágenes pesan)
    foto: imagenCambiada(v.foto, fila?.foto),
  };
}

const productosBase = crearServicio({ ruta: '/productos', desdeApi: productoDesdeApi, haciaApi: productoHaciaApi });

export const productosService = {
  ...productosBase,

  /** Productos que se están vendiendo (el portal y las cotizaciones solo usan estos). */
  async listarActivos() {
    return (await productosBase.listar()).filter((p) => p.activo);
  },

  /** En productos el estado viaja en la edición normal (PUT). */
  cambiarEstado: (fila, estado) => productosBase.enviar(fila, { activo: estado === 'Activo' }, { metodo: 'PUT' }),
};
