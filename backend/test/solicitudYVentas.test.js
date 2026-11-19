import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de la solicitud de cotización con su forma de entrega y sus datos
 * de contacto (migración 0043) y de lo vendido, lo cobrado y el saldo de
 * cada venta.
 */

let e;
const t = {};
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const enDias = (n) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(Date.now() + n * 86_400_000));

const solicitar = (cuerpo) => e.api('/cotizaciones', { metodo: 'POST', token: t.maria, cuerpo });
const linea = () => [{ tipo: 'producto', productoId: 1, cantidad: 2 }];

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');
});

after(async () => {
  await e?.cerrar();
});

describe('Solicitud de cotización: entrega y contacto', () => {
  test('recoger en el local no pide dirección y guarda los datos de contacto', async () => {
    const r = await solicitar({
      modoEntrega: 'Recoge',
      telefonoContacto: '300 123 4567',
      fechaRequerida: enDias(5),
      observaciones: 'Son para el eje trasero; llamar antes.',
      lineas: linea(),
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const c = (await e.api(`/cotizaciones/${r.cuerpo.datos.numero}`, { token: t.admin })).cuerpo.datos;
    assert.equal(c.modoEntrega, 'Recoge');
    assert.equal(c.direccionEntrega, null);
    assert.equal(c.telefonoContacto, '3001234567', 'se guarda sin espacios');
    assert.equal(c.fechaRequerida, enDias(5));
    assert.equal(c.observaciones, 'Son para el eje trasero; llamar antes.');
  });

  test('el despacho sigue igual que antes: con su dirección', async () => {
    const r = await solicitar({ direccionEntrega: 'Calle 50 #45-12, Medellín', lineas: linea() });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const c = (await e.api(`/cotizaciones/${r.cuerpo.datos.numero}`, { token: t.admin })).cuerpo.datos;
    assert.equal(c.modoEntrega, 'Despacho');
    assert.equal(c.direccionEntrega, 'Calle 50 #45-12, Medellín');
  });

  test('valida la dirección del despacho, el teléfono y la fecha', async () => {
    const sinDireccion = await solicitar({ modoEntrega: 'Despacho', lineas: linea() });
    assert.equal(sinDireccion.estado, 422);
    assert.ok(sinDireccion.cuerpo.detalles.some((d) => d.campo === 'direccionEntrega'));

    const telefono = await solicitar({ modoEntrega: 'Recoge', telefonoContacto: '12345', lineas: linea() });
    assert.equal(telefono.estado, 422);

    const pasada = await solicitar({ modoEntrega: 'Recoge', fechaRequerida: enDias(-2), lineas: linea() });
    assert.equal(pasada.estado, 422);

    const lejana = await solicitar({ modoEntrega: 'Recoge', fechaRequerida: enDias(400), lineas: linea() });
    assert.equal(lejana.estado, 422);

    const modo = await solicitar({ modoEntrega: 'Por correo', direccionEntrega: 'Cl 1', lineas: linea() });
    assert.equal(modo.estado, 422);
  });

  test('el portal ve cómo recibirá su pedido', async () => {
    const portal = await e.api('/portal/resumen', { token: t.maria });
    assert.equal(portal.estado, 200);
    const lista = portal.cuerpo.datos.cotizaciones;
    const recoge = lista.find((c) => c.modoEntrega === 'Recoge');
    assert.ok(recoge, 'la solicitud para recoger aparece en el portal');
    assert.equal(recoge.observaciones, 'Son para el eje trasero; llamar antes.');
  });
});

describe('Ventas: vendido, cobrado y saldo', () => {
  test('cada venta trae lo vendido, lo cobrado y el saldo', async () => {
    const r = await e.api('/ventas?porPagina=100', { token: t.admin });
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.datos.length > 0);
    for (const v of r.cuerpo.datos) {
      assert.equal(typeof v.totalVendido, 'number');
      assert.equal(typeof v.cobrado, 'number');
      assert.equal(typeof v.saldo, 'number');
      if (v.metodoPago === 'Contado' && !v.credito) {
        assert.equal(v.totalVendido, v.cobrado, 'de contado lo vendido es lo cobrado');
        assert.equal(v.saldo, 0);
      }
    }
  });

  test('a crédito, lo vendido es el monto pactado y el saldo es lo que falta del crédito', async () => {
    const { rows } = await e.db.query(
      `SELECT v.numero, cr.monto_total::int AS monto, cr.saldo_pendiente::int AS saldo, v.total::int AS cobrado
         FROM venta v JOIN credito cr ON cr.venta_id = v.id LIMIT 1`,
    );
    if (!rows[0]) return; // los datos de prueba no traen ventas a crédito
    const v = (await e.api(`/ventas?q=${rows[0].numero}`, { token: t.admin })).cuerpo.datos[0];
    assert.equal(v.totalVendido, rows[0].monto);
    assert.equal(v.cobrado, rows[0].cobrado);
    assert.equal(v.saldo, rows[0].saldo);
    assert.ok(v.totalVendido >= v.cobrado);
  });
});

describe('Reencauche desde el portal', () => {
  test('la fecha que prefiere el cliente es desde mañana', async () => {
    const banda = (await e.api('/portal/bandas', { token: t.maria })).cuerpo.datos?.[0];
    if (!banda) return; // sin bandas en los datos de prueba lo cubre reencauche.test.js
    const pedir = (fechaPreferida) =>
      e.api('/portal/reencauches', {
        metodo: 'POST',
        token: t.maria,
        cuerpo: { bandaId: banda.id, medida: banda.medidas[0], cantidad: 1, lugar: 'Local', fechaPreferida },
      });
    assert.equal((await pedir(hoy())).estado, 422);
  });
});
