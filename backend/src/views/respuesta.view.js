/**
 * Vista base de la API.
 *
 * En una API REST la "vista" del patrón MVC es la respuesta JSON: aquí se
 * decide la forma en que salen los datos. Todos los controladores
 * responden a través de estas funciones (o de una vista de su módulo que
 * las usa), así el formato es el mismo en toda la API:
 *
 *   listado  → { datos: [...], total, pagina, porPagina }
 *   registro → { datos: {...} }
 *   vacío    → 204 sin cuerpo
 */

/** Responde un listado paginado. */
export function enviarLista(res, { filas, total, pagina, porPagina }) {
  res.json({ datos: filas, total, pagina, porPagina });
}

/** Responde un listado completo, sin paginar (roles, permisos). */
export function enviarTodo(res, filas) {
  res.json({ datos: filas });
}

/** Responde un registro. `estado` = 201 cuando se acaba de crear. */
export function enviarDato(res, datos, estado = 200) {
  res.status(estado).json({ datos });
}

/** Responde "sin contenido" (por ejemplo, después de eliminar). */
export function enviarSinContenido(res) {
  res.status(204).end();
}

/** Copia un objeto sin los campos indicados (datos internos). */
export function omitir(fila, campos) {
  return Object.fromEntries(Object.entries(fila).filter(([clave]) => !campos.includes(clave)));
}
