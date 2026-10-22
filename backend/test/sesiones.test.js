import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { solicitud } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de una sola sesión por cuenta y de la cancelación de una
 * cotización sin borrarla.
 */

let e;

before(async () => {
  e = await levantarEntorno();
});

after(async () => {
  await e?.cerrar();
});

describe('Una cuenta, un dispositivo', () => {
  test('al iniciar sesión en otro dispositivo, la sesión anterior se cierra', async () => {
    const primero = await e.iniciarSesion('pedro.m@mirallantas.com');
    assert.equal((await e.api('/auth/yo', { token: primero })).estado, 200);

    const segundo = await e.iniciarSesion('pedro.m@mirallantas.com');
    const viejo = await e.api('/auth/yo', { token: primero });
    assert.equal(viejo.estado, 401);
    assert.match(viejo.cuerpo.error, /otro dispositivo/);
    assert.equal((await e.api('/auth/yo', { token: segundo })).estado, 200);
  });
});

describe('Cancelar una cotización', () => {
  test('exige el motivo y queda Rechazada sin borrarse', async () => {
    const admin = await e.iniciarSesion('admin@mirallantas.com');
    const luis = await e.iniciarSesion('lfmora@yahoo.com');
    const creada = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: luis,
      cuerpo: solicitud([{ tipo: 'producto', productoId: 1, cantidad: 1 }]),
    });
    assert.equal(creada.estado, 201, JSON.stringify(creada.cuerpo));
    const numero = creada.cuerpo.datos.numero;

    const sinMotivo = await e.api(`/cotizaciones/${numero}`, { metodo: 'PATCH', token: admin, cuerpo: { estado: 'Rechazada' } });
    assert.equal(sinMotivo.estado, 422);

    const cancelada = await e.api(`/cotizaciones/${numero}`, {
      metodo: 'PATCH',
      token: admin,
      cuerpo: { estado: 'Rechazada', motivoCancelacion: 'El cliente ya no la necesita' },
    });
    assert.equal(cancelada.estado, 200, JSON.stringify(cancelada.cuerpo));

    const despues = await e.api(`/cotizaciones/${numero}`, { token: admin });
    assert.equal(despues.estado, 200, 'sigue existiendo');
    assert.equal(despues.cuerpo.datos.estado, 'Rechazada');
  });
});

describe('El cliente cancela su cotización', () => {
  test('pendiente y sin aceptar: la cancela con motivo; ajena o sin motivo, no', async () => {
    const luis = await e.iniciarSesion('lfmora@yahoo.com');
    const creada = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: luis,
      cuerpo: solicitud([{ tipo: 'producto', productoId: 1, cantidad: 2 }]),
    });
    const numero = creada.cuerpo.datos.numero;
    const cancelar = (token, cuerpo) => e.api(`/portal/cotizaciones/${numero}/cancelar`, { metodo: 'POST', token, cuerpo });

    assert.equal((await cancelar(luis, {})).estado, 422, 'el motivo es obligatorio');
    const maria = await e.iniciarSesion('maria.gomez@gmail.com').catch(() => null);
    if (maria) assert.equal((await cancelar(maria, { motivo: 'No es mía' })).estado, 404, 'no cancela una ajena');

    const ok = await cancelar(luis, { motivo: 'Ya conseguí las llantas' });
    assert.equal(ok.estado, 200, JSON.stringify(ok.cuerpo));
    assert.equal(ok.cuerpo.datos.estado, 'Rechazada');
    assert.equal((await cancelar(luis, { motivo: 'Otra vez' })).estado, 422, 'ya no está pendiente');
  });
});
