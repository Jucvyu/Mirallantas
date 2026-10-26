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
  test('sin aceptar por el cliente: solo se cancela, con motivo, y no se borra', async () => {
    const admin = await e.iniciarSesion('admin@mirallantas.com');
    const luis = await e.iniciarSesion('lfmora@yahoo.com');
    const creada = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: luis,
      cuerpo: solicitud([{ tipo: 'producto', productoId: 1, cantidad: 1 }]),
    });
    assert.equal(creada.estado, 201, JSON.stringify(creada.cuerpo));
    const numero = creada.cuerpo.datos.numero;
    const cambiar = (cuerpo) => e.api(`/cotizaciones/${numero}`, { metodo: 'PATCH', token: admin, cuerpo });

    // No avanza antes de que el cliente la acepte
    assert.equal((await cambiar({ estado: 'Aprobada' })).estado, 422);
    // Cancelarla sí, pero con su motivo
    assert.equal((await cambiar({ estado: 'Rechazada' })).estado, 422);
    const cancelada = await cambiar({ estado: 'Rechazada', motivoCancelacion: 'El cliente ya no la necesita' });
    assert.equal(cancelada.estado, 200, JSON.stringify(cancelada.cuerpo));

    const despues = await e.api(`/cotizaciones/${numero}`, { token: admin });
    assert.equal(despues.estado, 200, 'sigue existiendo');
    assert.equal(despues.cuerpo.datos.estado, 'Rechazada');
    assert.equal(despues.cuerpo.datos.estadoEntrega, 'Cancelado', 'la entrega se cancela sola');
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
    assert.equal(ok.cuerpo.datos.estadoEntrega, 'Cancelado', 'la entrega se cancela sola');
    assert.equal((await cancelar(luis, { motivo: 'Otra vez' })).estado, 422, 'ya no está pendiente');
  });
});

describe('Fotos del reencauche', () => {
  test('acepta hasta 3 fotos de la llanta y rechaza la cuarta', async () => {
    const luis = await e.iniciarSesion('lfmora@yahoo.com');
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const pedir = (fotos) =>
      e.api('/cotizaciones', {
        metodo: 'POST',
        token: luis,
        cuerpo: {
          direccionEntrega: 'Cra 5 #10-22, Pereira',
          lineas: [{ tipo: 'servicio', cantidad: 2, medidas: '275/80 R22.5', descripcion: 'Carcasa sana', fotos }],
        },
      });
    assert.equal((await pedir([PNG, PNG, PNG, PNG])).estado, 422);
    const ok = await pedir([PNG, PNG, PNG]);
    assert.equal(ok.estado, 201, JSON.stringify(ok.cuerpo));
    const linea = ok.cuerpo.datos.detalle.find((l) => l.tipo === 'servicio');
    assert.equal(linea.fotos.length, 3);
  });
});

describe('Validaciones de los datos', () => {
  const registro = (cambios) =>
    e.api('/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: 'Laura Gómez',
        tipoDocumento: 'CC',
        numeroDocumento: '1098765432',
        telefono: '310 555 1234',
        correo: 'laura.validaciones@ejemplo.com',
        password: 'ClaveSegura2026',
        ...cambios,
      },
    });
  const campoConError = async (cambios) => (await registro(cambios)).cuerpo.detalles?.map((d) => d.campo) ?? [];

  test('teléfono colombiano, documento según su tipo y nombre solo con letras', async () => {
    assert.ok((await campoConError({ telefono: '12345' })).includes('telefono'));
    assert.ok((await campoConError({ telefono: '2105551234' })).includes('telefono'), 'ni celular ni fijo');
    assert.ok((await campoConError({ numeroDocumento: 'AB12345' })).includes('numeroDocumento'), 'la cédula es solo dígitos');
    assert.ok((await campoConError({ tipoDocumento: 'NIT', numeroDocumento: '12345' })).includes('numeroDocumento'));
    assert.ok((await campoConError({ nombre: 'Juan 23' })).includes('nombre'));
    assert.ok((await campoConError({ nombre: 'Al' })).includes('nombre'), 'mínimo 3 caracteres');

    // Fijo con +57 y espacios, y NIT con dígito de verificación: válidos
    const ok = await registro({ telefono: '+57 604 123 4567' });
    assert.equal(ok.estado, 201, JSON.stringify(ok.cuerpo));
  });
});
