import { ZodError } from 'zod';

/** Error con un código HTTP y un mensaje apto para mostrar al usuario. */
export class HttpError extends Error {
  constructor(estado, mensaje, detalles, codigo) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
    // Código fijo que el frontend puede revisar (p. ej. '2FA_REQUERIDO')
    this.codigo = codigo;
    // Datos extra que viajan en la respuesta (p. ej. intentos restantes)
    this.extra = undefined;
  }

  /** Agrega datos a la respuesta de error: new HttpError(…).con({ intentosRestantes: 2 }) */
  con(extra) {
    this.extra = extra;
    return this;
  }
}

export const noEncontrado = (que = 'El registro') => new HttpError(404, `${que} no existe.`);

/**
 * Traduce los errores de PostgreSQL que provienen de las reglas del esquema
 * a respuestas comprensibles. El detalle técnico se queda en el log.
 */
function desdePostgres(error) {
  switch (error.code) {
    case '23505': // unique_violation
      return new HttpError(409, mensajeUnico(error.constraint));
    case '23503': // foreign_key_violation
      if (error.message.includes('update or delete')) {
        return new HttpError(409, 'No se puede eliminar: otros registros dependen de este.');
      }
      return new HttpError(422, MENSAJES_LISTA[listaDe(error.constraint)] ?? 'Uno de los registros relacionados no existe.');
    case '23514': // check_violation
      return new HttpError(422, 'Algún valor no cumple una regla del negocio.');
    case '23502': // not_null_violation
      return new HttpError(422, `Falta el campo obligatorio "${error.column}".`);
    case '22P02': // invalid_text_representation (p. ej. id no numérico)
      return new HttpError(400, 'Algún valor de la solicitud no tiene el formato esperado.');
    case 'P0001': // RAISE EXCEPTION de un trigger (p. ej. el rol Administrador)
      return new HttpError(422, error.message);
    case '57014': // query_canceled por statement_timeout
      return new HttpError(503, 'La consulta tardó demasiado. Intenta de nuevo.');
    default:
      return null;
  }
}

/**
 * Valores que deben existir en una lista de la base (migración 0005). La
 * restricción se llama, por ejemplo, "cliente_tipo_documento_fk".
 */
const MENSAJES_LISTA = {
  tipo_documento: 'El tipo de documento no es válido.',
  metodo_pago: 'El método de pago no es válido.',
  medio_pago: 'El medio de pago no es válido.',
};
const listaDe = (restriccion = '') => Object.keys(MENSAJES_LISTA).find((lista) => restriccion.includes(lista)) ??
  (restriccion.includes('cuota_inicial_medio') ? 'medio_pago' : null);

/** Mensaje claro para cada restricción UNIQUE de la base de datos. */
const MENSAJES_UNICOS = {
  credito_un_abierto_por_cliente: 'El cliente ya tiene un crédito abierto: solo se permite uno a la vez.',
  // Cuentas: el mensaje no revela qué dato ya existe
  usuario_correo_unico: 'No pudimos guardar el usuario. Revisa los datos e inténtalo de nuevo.',
  producto_codigo_key: 'Ya existe un producto con ese código.',
  cliente_documento_unico: 'Ya existe un cliente con ese tipo y número de documento.',
  proveedor_documento_unico: 'Ya existe un proveedor con ese tipo y número de documento.',
  tercero_documento_unico: 'Ya existe un tercero con ese tipo y número de documento.',
  categoria_nombre_key: 'Ya existe una categoría con ese nombre.',
  marca_nombre_key: 'Ya existe una marca con ese nombre.',
  tipo_vehiculo_nombre_key: 'Ya existe un tipo de vehículo con ese nombre.',
  servicio_nombre_key: 'Ya existe un servicio con ese nombre.',
  rol_nombre_key: 'Ya existe un rol con ese nombre.',
  abono_clave_idempotencia_key: 'Ese abono ya se registró.',
  cotizacion_clave_idempotencia_key: 'Esa cotización ya se registró.',
  venta_cotizacion_id_key: 'Esa cotización ya generó una venta.',
};

function mensajeUnico(restriccion) {
  return MENSAJES_UNICOS[restriccion] ?? 'Ya existe un registro con esos datos.';
}

/** Middleware final de Express: toda respuesta de error pasa por aquí. */
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(error, req, res, next) {
  let http = error instanceof HttpError ? error : null;

  if (!http && error instanceof ZodError) {
    http = new HttpError(
      422,
      'Revisa los datos enviados.',
      error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    );
  }
  if (!http && error.type === 'entity.parse.failed') {
    http = new HttpError(400, 'El cuerpo de la solicitud no es un JSON válido.');
  }
  if (!http) http = desdePostgres(error);

  if (!http) {
    // Error inesperado: se registra completo pero no se expone
    console.error(error);
    http = new HttpError(500, 'Ocurrió un error inesperado. Intenta de nuevo.');
  }

  res.status(http.estado).json({
    error: http.message,
    ...(http.codigo ? { codigo: http.codigo } : {}),
    ...(http.extra ?? {}),
    ...(http.detalles ? { detalles: http.detalles } : {}),
  });
}
