/**
 * Middleware de validación.
 *
 * Aplica un esquema de Zod a una parte de la petición y deja el resultado
 * limpio en `req.validado[origen]`. Si los datos no cumplen, Zod lanza un
 * error que el manejador de errores convierte en una respuesta 422 con el
 * detalle de cada campo.
 *
 *   router.post('/', validar(esquemaNuevo), controlador.crear)
 *   router.get('/', validar(esquemaListado, 'query'), controlador.listar)
 *
 * Los esquemas viven en la carpeta validators/.
 */
export const validar = (esquema, origen = 'body') => async (req, res, next) => {
  // parseAsync: algunos campos (las imágenes) se procesan de forma asíncrona
  req.validado = { ...req.validado, [origen]: await esquema.parseAsync(req[origen] ?? {}) };
  next();
};
