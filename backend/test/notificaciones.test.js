import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Borrar notificaciones (una o todas) y su vencimiento a los 7 días.
 * Las del cliente son suyas y se borran de verdad; las del personal son
 * compartidas: lo que borra un usuario solo deja de verlo él.
 */

let e;
const t = {};

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
});

after(async () => {
  await e?.cerrar();
});

const clienteDeLuis = async () =>
  (await e.db.query("SELECT cliente_id FROM usuario WHERE correo = 'lfmora@yahoo.com'")).rows[0].cliente_id;

describe('Notificaciones del cliente', () => {
  test('borra una, luego todas; las de más de 7 días se borran solas', async () => {
    const cliente = await clienteDeLuis();
    await e.db.query('DELETE FROM notificacion WHERE cliente_id = $1', [cliente]);
    await e.db.query(
      `INSERT INTO notificacion (cliente_id, titulo, mensaje, creado_en) VALUES
         ($1, 'Uno', 'Primer aviso', now()), ($1, 'Dos', 'Segundo aviso', now()),
         ($1, 'Viejo', 'Aviso vencido', now() - interval '8 days')`,
      [cliente],
    );
    const lista = await e.api('/portal/notificaciones', { token: t.luis });
    const titulos = lista.cuerpo.datos.notificaciones.map((n) => n.titulo);
    assert.ok(!titulos.includes('Viejo'), 'el de más de 7 días ya no está');
    assert.equal(titulos.length, 2);

    const uno = lista.cuerpo.datos.notificaciones.find((n) => n.titulo === 'Uno');
    assert.equal((await e.api(`/portal/notificaciones/${uno.id}`, { metodo: 'DELETE', token: t.luis })).estado, 204);
    assert.equal((await e.api(`/portal/notificaciones/${uno.id}`, { metodo: 'DELETE', token: t.luis })).estado, 404);
    assert.equal((await e.api('/portal/notificaciones', { token: t.luis })).cuerpo.datos.notificaciones.length, 1);

    assert.equal((await e.api('/portal/notificaciones', { metodo: 'DELETE', token: t.luis })).estado, 204);
    assert.equal((await e.api('/portal/notificaciones', { token: t.luis })).cuerpo.datos.notificaciones.length, 0);
  });
});

describe('Avisos del personal', () => {
  test('borrar solo los quita para quien los borra; vencen a los 7 días', async () => {
    await e.db.query(
      `INSERT INTO notificacion_personal (modulo, titulo, mensaje, creado_en) VALUES
         ('Pedidos-Cotización', 'Aviso A', 'Primero', now()), ('Pedidos-Cotización', 'Aviso B', 'Segundo', now()),
         ('Pedidos-Cotización', 'Aviso viejo', 'Vencido', now() - interval '8 days')`,
    );
    // Otro usuario del personal (Administrador) que verá los mismos avisos
    const roles = await e.api('/roles', { token: t.admin });
    const rolAdmin = roles.cuerpo.datos.find((r) => r.nombre === 'Administrador').id;
    await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Otra Asesora', tipoDocumento: 'CC', numeroDocumento: '33445566', correo: 'otra@mirallantas.com', rolId: rolAdmin, password: 'ClaveSegura2026' },
    });
    const otra = await e.iniciarSesion('otra@mirallantas.com', 'ClaveSegura2026');

    const titulos = async (token) => (await e.api('/notificaciones', { token })).cuerpo.datos.notificaciones.map((n) => n.titulo);
    const mios = await e.api('/notificaciones', { token: t.admin });
    assert.ok(!(await titulos(t.admin)).includes('Aviso viejo'), 'el de más de 7 días ya no está');

    const a = mios.cuerpo.datos.notificaciones.find((n) => n.titulo === 'Aviso A');
    assert.equal((await e.api(`/notificaciones/${a.id}`, { metodo: 'DELETE', token: t.admin })).estado, 204);
    assert.ok(!(await titulos(t.admin)).includes('Aviso A'));
    assert.ok((await titulos(otra)).includes('Aviso A'), 'la otra persona lo sigue viendo');

    assert.equal((await e.api('/notificaciones', { metodo: 'DELETE', token: t.admin })).estado, 204);
    assert.equal((await titulos(t.admin)).length, 0);
    assert.ok((await titulos(otra)).includes('Aviso B'));
  });
});
