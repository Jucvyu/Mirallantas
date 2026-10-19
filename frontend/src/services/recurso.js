// =========================================================================
// Fábrica de servicios REST.
//
// La mayoría de los recursos de la API se usan igual: listar, ver uno,
// crear, editar y eliminar. `crearServicio` arma un servicio con esas
// operaciones para una ruta, y cada servicio de dominio (clientes,
// cotizaciones…) la usa y le agrega sus operaciones propias.
//
// Todos los servicios devuelven los datos YA convertidos al formato de la
// pantalla (con `desdeApi`) y convierten lo que llega de los formularios al
// formato de la API (con `haciaApi`). Las pantallas nunca ven las URL.
// =========================================================================

import { api, traerTodo } from './http';

/** Conversión que no cambia nada (para recursos que no la necesitan). */
const igual = (dato) => dato;

/**
 * opciones:
 *   ruta          ruta de la API, p. ej. '/clientes'
 *   desdeApi      convierte un registro de la API al formato de la pantalla
 *   haciaApi      (valores, fila, contexto) → cuerpo para la API. `fila`
 *                 solo existe al editar; `contexto` trae las listas que
 *                 hagan falta para convertir nombres en ids.
 *   metodoEditar  'PUT' (catálogos) o 'PATCH' (documentos)
 */
export function crearServicio({ ruta, desdeApi = igual, haciaApi = igual, metodoEditar = 'PUT' }) {
  /** Dirección de un registro: /clientes/5 o /cotizaciones/PED-2024-001. */
  const rutaDe = (filaOId) => `${ruta}/${encodeURIComponent(filaOId?.id ?? filaOId)}`;

  return {
    ruta,
    desdeApi,

    /** Todos los registros, ya en formato de pantalla. */
    async listar() {
      return (await traerTodo(ruta)).map(desdeApi);
    },

    /** Un registro (con su detalle, si la API lo trae). */
    async obtener(filaOId) {
      const { datos } = await api(rutaDe(filaOId));
      return desdeApi(datos);
    },

    /** Crea un registro a partir de los valores de un formulario. */
    async crear(valores, contexto) {
      const { datos } = await api(ruta, { metodo: 'POST', cuerpo: haciaApi(valores, null, contexto) });
      return datos;
    },

    /** Guarda los cambios de un registro. */
    async editar(fila, valores, contexto) {
      const { datos } = await api(rutaDe(fila), { metodo: metodoEditar, cuerpo: haciaApi(valores, fila, contexto) });
      return datos;
    },

    /** Elimina un registro. */
    async eliminar(fila) {
      await api(rutaDe(fila), { metodo: 'DELETE' });
    },

    /**
     * Petición a medida sobre un registro, para las operaciones propias de
     * cada servicio (cambiar estado, confirmar un valor…).
     *   enviar(fila, { estado: 'Aprobada' })                 → PATCH /ruta/:id
     *   enviar(fila, { activo: true }, { sufijo: '/estado' }) → PATCH /ruta/:id/estado
     */
    async enviar(fila, cuerpo, { metodo = 'PATCH', sufijo = '' } = {}) {
      const respuesta = await api(`${rutaDe(fila)}${sufijo}`, { metodo, cuerpo });
      return respuesta?.datos;
    },
  };
}
