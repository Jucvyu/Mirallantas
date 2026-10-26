import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas del pago de los servicios de reencauche (se cobran aparte de la
 * cotización), de las notificaciones al cliente y del abono rechazado.
 */

// Imagen PNG real de 1×1 píxel
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let e;
const t = {};

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');
});

after(async () => {
  await e?.cerrar();
});

/** Línea del servicio en el resumen del portal de Luis. */
async function servicioEnPortal() {
  const r = await e.api('/portal/resumen', { token: t.luis });
  return r.cuerpo.datos.cotizaciones.flatMap((c) => c.detalle).find((l) => l.solicitudServicio === t.solicitud);
}

const pagar = (cuerpo, token = t.luis) =>
  e.api(`/portal/servicios/${t.solicitud}/pago`, { metodo: 'POST', token, cuerpo });

describe('Pago de un servicio de reencauche', () => {
  test('el servicio entra a la cotización sin cobrarse', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: {
        metodoPago: 'Contado',
        direccionEntrega: 'Cra 5 #10-22, Pereira',
        lineas: [{ tipo: 'servicio', cantidad: 2, medidas: '295/80R22.5', descripcion: 'Carcasa sana', foto: PNG }],
      },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.total, 0);
    t.solicitud = r.cuerpo.datos.detalle[0].solicitudServicio;

    const solicitud = await e.api(`/solicitudes-servicio/${t.solicitud}`, { token: t.admin });
    assert.equal(solicitud.cuerpo.datos.pagoEstado, 'Sin precio');
    assert.equal(solicitud.cuerpo.datos.cotizacion, r.cuerpo.datos.numero);
  });

  test('sin precio no se paga, y sin pago el reencauche no avanza', async () => {
    assert.equal((await pagar({ medioPago: 'Efectivo' })).estado, 422);
    const avanzar = await e.api(`/solicitudes-servicio/${t.solicitud}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'En proceso' },
    });
    assert.equal(avanzar.estado, 422);
    assert.match(avanzar.cuerpo.error, /pago/);
  });

  test('el precio se asigna después de revisar la carcasa (Apta, con observación y garantía)', async () => {
    const sinRevision = await e.api(`/solicitudes-servicio/${t.solicitud}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { costo: 500000, precio: 640000 },
    });
    assert.equal(sinRevision.estado, 422);
    assert.match(sinRevision.cuerpo.error, /revisa la carcasa/);

    // La revisión exige observación y garantía
    const sinGarantia = await e.api(`/solicitudes-servicio/${t.solicitud}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estadoEvidencia: 'Apta', observacionRevision: 'Sana' } });
    assert.equal(sinGarantia.estado, 422);
    const revisada = await e.api(`/solicitudes-servicio/${t.solicitud}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estadoEvidencia: 'Apta', observacionRevision: 'Carcasa sana, sin cortes', garantia: true },
    });
    assert.equal(revisada.estado, 200, JSON.stringify(revisada.cuerpo));
    assert.equal(revisada.cuerpo.datos.garantia, true);
  });

  test('al ponerle precio, el cliente recibe la notificación', async () => {
    const r = await e.api(`/solicitudes-servicio/${t.solicitud}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { precio: 640000 },
    });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.pagoEstado, 'Por pagar');

    const avisos = await e.api('/portal/notificaciones', { token: t.luis });
    assert.ok(avisos.cuerpo.datos.sinLeer >= 1);
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.includes(t.solicitud)));
  });

  test('una transferencia exige el comprobante; con él queda en revisión', async () => {
    assert.equal((await pagar({ medioPago: 'Transferencia' })).estado, 422);
    assert.equal((await pagar({ medioPago: 'Transferencia', comprobante: PNG }, t.maria)).estado, 404, 'no es de María');
    assert.equal((await pagar({ medioPago: 'Transferencia', comprobante: PNG })).estado, 204);

    const linea = await servicioEnPortal();
    assert.equal(linea.pagoEstado, 'En revisión');
    assert.ok(linea.pagoComprobante);
    assert.equal(linea.precioServicio, 640000);
  });

  test('si el pago se rechaza, el cliente ve el motivo y vuelve a subirlo', async () => {
    const sinMotivo = await e.api(`/solicitudes-servicio/${t.solicitud}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Rechazado' },
    });
    assert.equal(sinMotivo.estado, 422);

    const rechazo = await e.api(`/solicitudes-servicio/${t.solicitud}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Rechazado', motivo: 'El comprobante no se lee' },
    });
    assert.equal(rechazo.cuerpo.datos.pagoEstado, 'Rechazado');

    const linea = await servicioEnPortal();
    assert.equal(linea.pagoEstado, 'Rechazado');
    assert.equal(linea.pagoMotivo, 'El comprobante no se lee');

    // Lo vuelve a subir
    assert.equal((await pagar({ medioPago: 'Transferencia', comprobante: PNG })).estado, 204);
    assert.equal((await servicioEnPortal()).pagoEstado, 'En revisión');
  });

  test('con el pago aprobado el reencauche sigue sus estados normales', async () => {
    const aprobado = await e.api(`/solicitudes-servicio/${t.solicitud}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Aprobado' },
    });
    assert.equal(aprobado.cuerpo.datos.pagoEstado, 'Aprobado');
    assert.equal((await pagar({ medioPago: 'Efectivo' })).estado, 422, 'ya está pagado');

    // Todo pagado: la cotización pasa sola a Aprobada, su valor incluye el
    // servicio y el personal recibe el aviso
    const cotizacion = await e.api(`/cotizaciones/${aprobado.cuerpo.datos.cotizacion}`, { token: t.admin });
    assert.equal(cotizacion.cuerpo.datos.estado, 'Aprobada');
    assert.equal(cotizacion.cuerpo.datos.estadoPago, 'Aprobado');
    assert.ok(cotizacion.cuerpo.datos.totalServicios > 0);
    const avisos = await e.api('/notificaciones', { token: t.admin });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo === 'Pago completo'));
    // Solo tiene reencauche: no hay llantas que comprar
    const compras = await e.api('/compras?porPagina=100', { token: t.admin });
    assert.ok(!compras.cuerpo.datos.some((c) => c.cotizacion === cotizacion.cuerpo.datos.numero), 'sin compra');

    const avanzar = await e.api(`/solicitudes-servicio/${t.solicitud}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'En proceso' },
    });
    assert.equal(avanzar.estado, 200, JSON.stringify(avanzar.cuerpo));

    // Aprobada, sus datos ya no se editan; cancelarla exige el motivo
    assert.equal((await e.api(`/solicitudes-servicio/${t.solicitud}`, { metodo: 'PATCH', token: t.admin, cuerpo: { medidas: '295/80 R22.5' } })).estado, 422);
    assert.equal((await e.api(`/solicitudes-servicio/${t.solicitud}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Cancelado' } })).estado, 422);

    const otroPrecio = await e.api(`/solicitudes-servicio/${t.solicitud}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { precio: 1 },
    });
    assert.equal(otroPrecio.estado, 422, 'pagado, su valor no cambia');
  });

  test('las notificaciones se marcan como leídas', async () => {
    assert.equal((await e.api('/portal/notificaciones/leidas', { metodo: 'POST', token: t.luis })).estado, 204);
    const avisos = await e.api('/portal/notificaciones', { token: t.luis });
    assert.equal(avisos.cuerpo.datos.sinLeer, 0);
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.startsWith('Pago aprobado')));
  });
});

describe('Abono rechazado', () => {
  test('el cliente ve el motivo, recibe el aviso y puede volver a subirlo', async () => {
    const credito = (await e.api('/creditos', { token: t.maria })).cuerpo.datos.find((c) => c.saldoPendiente > 0);
    const abono = await e.api(`/creditos/${credito.numero}/abonos`, {
      metodo: 'POST',
      token: t.maria,
      cuerpo: { monto: 20000, medioPago: 'Transferencia', comprobante: PNG },
    });
    assert.equal(abono.estado, 201);

    const rechazo = await e.api(`/abonos/${abono.cuerpo.datos.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Rechazado', motivo: 'La consignación no aparece en el banco.' },
    });
    assert.equal(rechazo.estado, 200);
    assert.equal(rechazo.cuerpo.datos.motivoRechazo, 'La consignación no aparece en el banco.');

    const portal = await e.api('/portal/resumen', { token: t.maria });
    const enPortal = portal.cuerpo.datos.abonos.find((a) => a.numero === abono.cuerpo.datos.numero);
    assert.equal(enPortal.estado, 'Rechazado');
    assert.equal(enPortal.motivoRechazo, 'La consignación no aparece en el banco.');

    const avisos = await e.api('/portal/notificaciones', { token: t.maria });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.startsWith('Abono rechazado')));

    // Vuelve a subirlo: es un abono nuevo, pendiente
    const otraVez = await e.api(`/creditos/${credito.numero}/abonos`, {
      metodo: 'POST',
      token: t.maria,
      cuerpo: { monto: 20000, medioPago: 'Transferencia', comprobante: PNG },
    });
    assert.equal(otraVez.estado, 201);
    assert.equal(otraVez.cuerpo.datos.estado, 'Pendiente');
  });
});

describe('Carcasa no apta', () => {
  test('cancela el reencauche solo, con la observación como motivo, y cierra el proceso', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: {
        metodoPago: 'Contado',
        direccionEntrega: 'Cra 5 #10-22, Pereira',
        lineas: [{ tipo: 'servicio', cantidad: 1, medidas: '11R22.5', descripcion: 'Llanta con cortes laterales', foto: PNG }],
      },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const numero = r.cuerpo.datos.detalle[0].solicitudServicio;
    const ruta = `/solicitudes-servicio/${numero}`;

    const revisada = await e.api(ruta, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estadoEvidencia: 'No apta', observacionRevision: 'Cortes profundos en el costado' },
    });
    assert.equal(revisada.estado, 200, JSON.stringify(revisada.cuerpo));
    assert.equal(revisada.cuerpo.datos.estado, 'Cancelado');
    assert.equal(revisada.cuerpo.datos.motivoCancelacion, 'Cortes profundos en el costado');

    // La revisión no se repite y el reencauche cancelado ya no cambia
    const otraRevision = await e.api(ruta, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estadoEvidencia: 'Apta', observacionRevision: 'Me equivoqué al revisar', garantia: true },
    });
    assert.equal(otraRevision.estado, 422);
    assert.equal((await e.api(ruta, { metodo: 'PATCH', token: t.admin, cuerpo: { medidas: '12R22.5' } })).estado, 422);

    // El cliente recibe el aviso con el motivo
    const avisos = await e.api('/portal/notificaciones', { token: t.luis });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.includes(numero) && n.mensaje.includes('Cortes profundos')));
  });
});
