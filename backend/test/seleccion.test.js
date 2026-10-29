import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * GET /seleccion/clientes: los clientes elegibles en los formularios son
 * solo las fichas con una cuenta de usuario activa de rol Cliente. Trae el
 * documento, y el portal (rol Cliente) no puede consultarlo.
 */

let e;
const t = {};

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');
});

after(async () => {
  await e?.cerrar();
});

describe('Clientes seleccionables', () => {
  test('lista los clientes con usuario de rol Cliente, con su documento', async () => {
    const r = await e.api('/seleccion/clientes', { token: t.admin });
    assert.equal(r.estado, 200);
    const clientes = r.cuerpo.datos;
    assert.ok(Array.isArray(clientes) && clientes.length >= 1);
    const maria = clientes.find((c) => c.numeroDocumento === '1024567890');
    assert.ok(maria, 'María (rol Cliente) está en la lista');
    assert.equal(maria.tipoDocumento, 'CC');
    assert.ok(maria.nombreCompleto);
  });

  test('no incluye una ficha de cliente sin cuenta de usuario', async () => {
    const { rows } = await e.db.query(
      `INSERT INTO cliente (tipo_documento, numero_documento, nombre_completo, telefono, activo)
       VALUES ('CC', '99999999', 'Ficha Sin Cuenta', '3000000000', TRUE) RETURNING id`,
    );
    try {
      const r = await e.api('/seleccion/clientes', { token: t.admin });
      const sinCuenta = r.cuerpo.datos.find((c) => c.numeroDocumento === '99999999');
      assert.equal(sinCuenta, undefined, 'una ficha sin usuario no es seleccionable');
    } finally {
      await e.db.query('DELETE FROM cliente WHERE id = $1', [rows[0].id]);
    }
  });

  test('un cliente del portal no puede consultarlo', async () => {
    const r = await e.api('/seleccion/clientes', { token: t.maria });
    assert.equal(r.estado, 403);
  });
});
