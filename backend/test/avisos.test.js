import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de los permisos de la vista de cliente, del estado de pago de las
 * cotizaciones (Pendiente / Aprobado / Rechazado) y de los avisos del
 * personal de Pedidos-Cotización.
 */

// Imagen PNG real de 1×1 píxel
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let e;
const t = {};

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.asesor = await e.iniciarSesion('ana.rios@mirallantas.com');
  t.secretaria = await e.iniciarSesion('pedro.m@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
});

after(async () => {
  await e?.cerrar();
});

const contado = {
  metodoPago: 'Contado',
  direccionEntrega: 'Cra 5 #10-22, Pereira',
  lineas: [{ tipo: 'producto', productoId: 1, cantidad: 1 }],
  pago: { medioPago: 'Transferencia', comprobante: PNG },
};

describe('Permisos de la vista de cliente', () => {
  test('el Cliente y el Administrador tienen Catálogo, Mis cotizaciones y Mi cartera', async () => {
    for (const token of [t.admin, t.luis]) {
      const r = await e.api('/auth/yo', { token });
      for (const permiso of ['Catálogo (portal)', 'Mis cotizaciones', 'Mi cartera']) {
        assert.ok(r.cuerpo.usuario.permisos.includes(permiso), permiso);
      }
    }
  });

  test('un rol del personal no los tiene si no se le dan', async () => {
    const r = await e.api('/auth/yo', { token: t.asesor });
    assert.ok(!r.cuerpo.usuario.permisos.includes('Mis cotizaciones'));
  });
});

describe('Estado de pago y avisos de Pedidos-Cotización', () => {
  test('una cotización de contado del portal queda con pago Pendiente y avisa al personal', async () => {
    const r = await e.api('/cotizaciones', { metodo: 'POST', token: t.luis, cuerpo: contado });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estadoPago, 'Pendiente');
    t.numero = r.cuerpo.datos.numero;

    for (const token of [t.admin, t.asesor]) {
      const avisos = await e.api('/notificaciones', { token });
      assert.equal(avisos.estado, 200);
      assert.ok(avisos.cuerpo.datos.sinLeer >= 1);
      assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.mensaje.includes(t.numero)));
    }
  });

  test('sin el módulo Pedidos-Cotización no llegan avisos; el cliente no entra', async () => {
    const secretaria = await e.api('/notificaciones', { token: t.secretaria });
    assert.equal(secretaria.estado, 200);
    assert.deepEqual(secretaria.cuerpo.datos, { notificaciones: [], sinLeer: 0 });

    const cliente = await e.api('/notificaciones', { token: t.luis });
    assert.equal(cliente.estado, 403);
  });

  test('al abrir la campana quedan vistos solo para ese usuario', async () => {
    const leidas = await e.api('/notificaciones/leidas', { metodo: 'POST', token: t.asesor });
    assert.equal(leidas.estado, 204);
    const asesor = await e.api('/notificaciones', { token: t.asesor });
    assert.equal(asesor.cuerpo.datos.sinLeer, 0);
    const admin = await e.api('/notificaciones', { token: t.admin });
    assert.ok(admin.cuerpo.datos.sinLeer >= 1);
  });

  test('rechazado y vuelto a subir: el estado cambia y el personal recibe el aviso', async () => {
    const rechazo = await e.api(`/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Rechazado', motivo: 'No aparece' },
    });
    assert.equal(rechazo.cuerpo.datos.estadoPago, 'Rechazado');

    const portal = await e.api('/portal/resumen', { token: t.luis });
    const enPortal = portal.cuerpo.datos.cotizaciones.find((c) => c.numero === t.numero);
    assert.equal(enPortal.estadoPago, 'Rechazado');

    const otra = await e.api(`/portal/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { medioPago: 'Transferencia', comprobante: PNG },
    });
    assert.equal(otra.estado, 200, JSON.stringify(otra.cuerpo));
    assert.equal(otra.cuerpo.datos.estadoPago, 'Pendiente');

    const avisos = await e.api('/notificaciones', { token: t.asesor });
    assert.equal(avisos.cuerpo.datos.sinLeer, 1);
    assert.equal(avisos.cuerpo.datos.notificaciones[0].titulo, 'Pago por revisar');
  });

  test('aprobado: el estado de pago queda Aprobado', async () => {
    const r = await e.api(`/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Aprobado' },
    });
    assert.equal(r.cuerpo.datos.estadoPago, 'Aprobado');
  });
});
