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
  modeloDesdeApi,
  modeloHaciaApi,
  productoDesdeApi,
  medidaTablaHaciaApi,
  referenciaDesdeApi,
  referenciaHaciaApi,
} from './adaptadores';
import { api, traerTodo } from './http';
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
 * Formulario de producto → cuerpo de la API. El código nunca se envía: lo
 * genera el servidor al crear y no cambia. `fila` solo existe al editar
 * (entonces viaja el estado). Las listas de `contexto` sirven para
 * convertir los nombres elegidos en ids.
 */
function productoHaciaApi(v, fila, { categorias, marcas, tipos }) {
  return {
    ...(fila ? { activo: activoDesdeEstado(v.estado) } : {}),
    nombre: v.nombre,
    descripcion: vacioANull(v.descripcion),
    categoriaId: idPorNombre(categorias, v.categoria),
    marcaId: idPorNombre(marcas, v.marca),
    medidas: v.medidas,
    tipoVehiculoId: idPorNombre(tipos, v.tipoVehiculo),
    // La foto solo se envía si cambió (las imágenes pesan)
    foto: imagenCambiada(v.foto, fila?.foto),
    // Solo la llanta reencauchada lleva precio fijo
    ...(fila?.reencauchada && parseCOP(v.precioVenta) ? { precioVenta: parseCOP(v.precioVenta) } : {}),
  };
}

const productosBase = crearServicio({ ruta: '/productos', desdeApi: productoDesdeApi, haciaApi: productoHaciaApi });

export const productosService = {
  ...productosBase,

  /** Productos que se están vendiendo (el portal y las cotizaciones solo usan estos). */
  async listarActivos() {
    return (await productosBase.listar()).filter((p) => p.disponible ?? p.activo);
  },

  /** Medidas (referencias) de un producto, para su página de detalle. */
  async deModelo(modeloId) {
    return (await traerTodo(`/productos?modeloId=${encodeURIComponent(modeloId)}`)).map(productoDesdeApi);
  },

  /** Un solo producto (la llanta reencauchada, que es una unidad única). */
  async unidad(productoId) {
    return (await traerTodo(`/productos?id=${encodeURIComponent(productoId)}`)).map(productoDesdeApi);
  },

  /** Medidas registradas en el catálogo, sin repetir (buscador de medidas). */
  async medidas() {
    const { datos } = await api('/productos/medidas');
    return datos;
  },

  /** En productos el estado viaja en la edición normal (PUT). */
  cambiarEstado: (fila, estado) => productosBase.enviar(fila, { activo: estado === 'Activo' }, { metodo: 'PUT' }),
};

/**
 * Todas las referencias (medidas) del catálogo con sus datos propios
 * (índice de carga, lonas…), para agruparlas bajo su modelo en el admin.
 */
export const referenciasService = {
  async listar() {
    return (await traerTodo('/productos')).map(referenciaDesdeApi);
  },
};

// ---- Modelos de llanta (panel admin) -----------------------------------------

const modelosBase = conCambioDeEstado(
  crearServicio({ ruta: '/modelos', desdeApi: modeloDesdeApi, haciaApi: modeloHaciaApi }),
);

/** Ruta de una medida de un modelo: /modelos/3/referencias/12 */
const rutaReferencia = (modelo, referencia) =>
  `/modelos/${encodeURIComponent(modelo.id)}/referencias${referencia ? `/${encodeURIComponent(referencia.id)}` : ''}`;

/**
 * Modelos de llanta: la llanta con su ficha técnica y su foto. Sus medidas
 * (referencias) son los productos que se venden; se agregan, editan y
 * activan desde aquí.
 */
export const modelosService = {
  ...modelosBase,

  /** Agrega una medida al modelo. */
  async crearReferencia(modelo, valores) {
    const { datos } = await api(rutaReferencia(modelo), { metodo: 'POST', cuerpo: referenciaHaciaApi(valores, null) });
    return referenciaDesdeApi(datos);
  },

  /** Guarda los cambios de una medida (también su estado). */
  async editarReferencia(modelo, referencia, valores) {
    const { datos } = await api(rutaReferencia(modelo, referencia), { metodo: 'PUT', cuerpo: referenciaHaciaApi(valores, referencia) });
    return referenciaDesdeApi(datos);
  },

  /**
   * Guarda todas las medidas de la tabla del producto en una sola
   * operación: si una falla, no se guarda ninguna. Devuelve el modelo.
   */
  async guardarReferencias(modelo, filas) {
    const { datos } = await api(rutaReferencia(modelo), { metodo: 'PUT', cuerpo: { referencias: filas.map(medidaTablaHaciaApi) } });
    return modeloDesdeApi(datos);
  },

  /** Activa o desactiva una medida. */
  async cambiarEstadoReferencia(modelo, referencia, estado) {
    await api(`${rutaReferencia(modelo, referencia)}/estado`, { metodo: 'PATCH', cuerpo: { activo: estado === 'Activo' } });
  },
};

/**
 * Catálogo público del landing (/api/catalogo): no necesita sesión y solo
 * trae productos activos con sus datos públicos (sin precios).
 */
export const catalogoPublicoService = {
  async listar() {
    return (await traerTodo('/catalogo')).map(productoDesdeApi);
  },

  /** Medidas a la venta de un producto, para su página de detalle pública. */
  async deModelo(modeloId) {
    return (await traerTodo(`/catalogo?modeloId=${encodeURIComponent(modeloId)}`)).map(productoDesdeApi);
  },

  /** Una llanta reencauchada (unidad única), para su página de detalle pública. */
  async unidad(productoId) {
    return (await traerTodo(`/catalogo?id=${encodeURIComponent(productoId)}`)).map(productoDesdeApi);
  },
};
