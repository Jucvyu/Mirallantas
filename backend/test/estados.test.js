import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de las listas del sistema (ahora en la base de datos), de los
 * estados Activo / Inactivo y del cambio de rol.
 */

let e;
const t = {};

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
});

after(async () => {
  await e?.cerrar();
});

/** Id de un registro por una columna (para no depender de ids fijos). */
const idDe = async (tabla, columna, valor) =>
  (await e.db.query(`SELECT id FROM ${tabla} WHERE ${columna} = $1`, [valor])).rows[0].id;

describe('Listas del sistema en la base de datos', () => {
  test('GET /referencias es pública y trae las listas', async () => {
    const r = await e.api('/referencias');
    assert.equal(r.estado, 200);
    assert.deepEqual(
      r.cuerpo.tiposDocumento.map((x) => x.codigo),
      ['CC', 'CE', 'NIT', 'Pasaporte'],
    );
    assert.equal(r.cuerpo.tiposDocumento[0].nombre, 'Cédula de ciudadanía');
    assert.deepEqual(r.cuerpo.metodosPago, ['Contado', 'Crédito']);
    assert.deepEqual(r.cuerpo.mediosPago, ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']);
  });

  test('los tipos de vehículo base vienen cargados', async () => {
    const r = await e.api('/tipos-vehiculo', { token: t.admin });
    for (const nombre of ['Turismo', 'SUV / Camioneta', 'Carga liviana', 'Camión / Tracto', 'Agrícola', 'Industrial']) {
      assert.ok(r.cuerpo.datos.some((tv) => tv.nombre === nombre), nombre);
    }
  });

  test('un valor que no está en la lista se rechaza con un mensaje claro', async () => {
    const r = await e.api('/clientes', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        tipoDocumento: 'XX',
        numeroDocumento: '123456789',
        nombreCompleto: 'Cliente Raro',
        telefono: '3001234567',
        correo: 'raro@ejemplo.com',
      },
    });
    assert.equal(r.estado, 422);
    assert.equal(r.cuerpo.error, 'El tipo de documento no es válido.');
  });
});

describe('Estado Inactivo', () => {
  test('si desactivan la cuenta con la sesión abierta, la siguiente petición lo avisa', async () => {
    const token = await e.iniciarSesion('pedro.m@mirallantas.com');
    const pedro = await idDe('usuario', 'correo', 'pedro.m@mirallantas.com');
    const r = await e.api(`/usuarios/${pedro}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: false } });
    assert.equal(r.estado, 200);

    const despues = await e.api('/auth/yo', { token });
    assert.equal(despues.estado, 403);
    assert.equal(despues.cuerpo.codigo, 'CUENTA_INACTIVA');

    await e.api(`/usuarios/${pedro}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: true } });
    assert.ok(await e.iniciarSesion('pedro.m@mirallantas.com'), 'reactivada vuelve a entrar');
  });

  test('un rol inactivo deja a sus usuarios por fuera', async () => {
    const rol = await idDe('rol', 'nombre', 'Secretaría');
    await e.api(`/roles/${rol}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: false } });
    const r = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'pedro.m@mirallantas.com', password: e.passwordDemo },
    });
    assert.equal(r.cuerpo.codigo, 'CUENTA_INACTIVA');
    await e.api(`/roles/${rol}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: true } });
  });

  test('un cliente inactivo no entra al portal', async () => {
    const cliente = await idDe('cliente', 'correo', 'lfmora@yahoo.com');
    const r = await e.api(`/clientes/${cliente}/estado`, { metodo: 'PATCH', token: t.admin, cuerpo: { activo: false } });
    assert.equal(r.estado, 200);
    const login = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'lfmora@yahoo.com', password: e.passwordDemo },
    });
    assert.equal(login.cuerpo.codigo, 'CUENTA_INACTIVA');
    await e.api(`/clientes/${cliente}/estado`, { metodo: 'PATCH', token: t.admin, cuerpo: { activo: true } });
  });

  test('no se crea un producto en una categoría inactiva', async () => {
    const categoria = await e.api('/categorias', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Categoría Pausada', descripcion: 'Categoría de prueba', color: '#3B82F6' },
    });
    await e.api(`/categorias/${categoria.cuerpo.datos.id}/estado`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { activo: false },
    });
    const marca = (await e.db.query('SELECT id FROM marca WHERE activo LIMIT 1')).rows[0].id;
    const r = await e.api('/productos', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Llanta de prueba',
        categoriaId: categoria.cuerpo.datos.id,
        marcaId: marca,
        medidas: '295/80R22.5',
      },
    });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /categoría está inactiva/);
  });

  test('un crédito inactivo no recibe abonos', async () => {
    const maria = await e.iniciarSesion('maria@gmail.com');
    const credito = (await e.api('/creditos', { token: maria })).cuerpo.datos.find((c) => c.saldoPendiente > 0);
    await e.api(`/creditos/${credito.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { activo: false } });
    const r = await e.api(`/creditos/${credito.numero}/abonos`, {
      metodo: 'POST',
      token: maria,
      cuerpo: { monto: 1000, medioPago: 'Efectivo' },
    });
    assert.equal(r.estado, 422);
    await e.api(`/creditos/${credito.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { activo: true } });
  });
});

describe('Cambio de rol', () => {
  test('un cliente al que hacen Administrador entra al panel y ve todo', async () => {
    const maria = await idDe('usuario', 'correo', 'maria@gmail.com');
    const tokenViejo = await e.iniciarSesion('maria@gmail.com');
    const admin = await idDe('rol', 'nombre', 'Administrador');

    const r = await e.api(`/usuarios/${maria}`, { metodo: 'PUT', token: t.admin, cuerpo: { rolId: admin } });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.rol, 'Administrador');
    assert.equal(r.cuerpo.datos.clienteId, null, 'ya no queda atada a su ficha de cliente');

    // Su sesión anterior se cerró; al volver a entrar es Administradora
    assert.equal((await e.api('/auth/yo', { token: tokenViejo })).estado, 401);
    const login = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'maria@gmail.com', password: e.passwordDemo },
    });
    assert.equal(login.cuerpo.usuario.rol, 'Administrador');
    assert.equal(login.cuerpo.usuario.clienteId, null);

    // Ve las cotizaciones de todos, no solo las suyas
    const todas = await e.api('/cotizaciones', { token: login.cuerpo.token });
    const total = (await e.db.query('SELECT COUNT(*)::int AS n FROM cotizacion')).rows[0].n;
    assert.equal(todas.cuerpo.total, total);
  });
});
