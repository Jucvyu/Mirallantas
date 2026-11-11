/**
 * Datos del flujo anterior de reencauche (un servicio dentro de la
 * cotización, con su solicitud de servicio). La API ya no los crea —las
 * cotizaciones son solo de llantas y el reencauche va por Revisiones y
 * Órdenes—, pero los que quedaron se siguen atendiendo hasta terminar. Estas
 * ayudas los registran directo en la base para poder probar ese camino.
 *
 * Los modelos se importan dentro de cada función: solo se pueden cargar
 * después de levantarEntorno (que define las variables de la API).
 */

/** Id del cliente de una cuenta del portal. */
async function clienteDe(e, correo) {
  const { rows } = await e.db.query('SELECT cliente_id FROM usuario WHERE correo = $1', [correo]);
  return rows[0].cliente_id;
}

/**
 * Agrega a una cotización existente un reencauche del flujo anterior, con su
 * solicitud de servicio "Pendiente de revisión". Devuelve el número (SOL-…).
 */
export async function agregarServicioLegado(e, numeroCotizacion, { cantidad = 1, medidas, descripcion = 'Carcasa sana', foto, fotos }) {
  const solicitudes = await import('../src/models/solicitudesServicio.model.js');
  const cotizaciones = await import('../src/models/cotizaciones.model.js');
  const cotizacion = (await e.db.query('SELECT id, cliente_id FROM cotizacion WHERE numero = $1', [numeroCotizacion])).rows[0];
  const servicio = (await e.db.query("SELECT id, nombre FROM servicio WHERE nombre = 'Reencauche'")).rows[0];
  const solicitud = await solicitudes.crear(e.db, {
    clienteId: cotizacion.cliente_id,
    servicioId: servicio.id,
    medidas,
    cantidad,
    descripcion,
    foto,
    fotos,
  });
  await cotizaciones.crearLinea(e.db, cotizacion.id, {
    tipo: 'servicio',
    servicioId: servicio.id,
    solicitudServicioId: solicitud.id,
    descripcion: servicio.nombre,
    medida: medidas,
    cantidad,
    // El servicio no se cobraba en la cotización: se le ponía precio aparte
    precioUnitario: 0,
  });
  return solicitud.numero;
}

/**
 * Cotización del flujo anterior que solo trae un reencauche (así quedaba:
 * de contado y sin precios que confirmar). Devuelve { numero, solicitud }.
 */
export async function cotizacionSoloServicioLegado(e, correoCliente, servicio) {
  const cotizaciones = await import('../src/models/cotizaciones.model.js');
  const { numero } = await cotizaciones.crear(e.db, {
    clienteId: await clienteDe(e, correoCliente),
    metodoPago: 'Contado',
    confirmado: true,
    direccionEntrega: 'Cra 5 #10-22, Pereira',
  });
  const solicitud = await agregarServicioLegado(e, numero, servicio);
  return { numero, solicitud };
}
