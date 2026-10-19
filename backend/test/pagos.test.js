import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas del pago de contado de una cotización (consignación, revisión,
 * rechazo e historial), de los datos que no se repiten entre cuentas y del
 * administrador principal.
 */

// Imagen PNG real de 1×1 píxel
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

const pedido = (pago) => ({
  metodoPago: 'Contado',
  direccionEntrega: 'Cra 5 #10-22, Pereira',
  lineas: [{ tipo: 'producto', productoId: 1, cantidad: 1 }],
  ...(pago ? { pago } : {}),
});

describe('Pago de contado de una cotización', () => {
  test('pide cómo se paga y la consignación (salvo en efectivo)', async () => {
    const sinPago = await e.api('/cotizaciones', { metodo: 'POST', token: t.luis, cuerpo: pedido() });
    assert.equal(sinPago.estado, 422);
    const sinComprobante = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: pedido({ medioPago: 'Transferencia' }),
    });
    assert.equal(sinComprobante.estado, 422);

    const ok = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: pedido({ medioPago: 'Transferencia', comprobante: PNG }),
    });
    assert.equal(ok.estado, 201, JSON.stringify(ok.cuerpo));
    assert.equal(ok.cuerpo.datos.pagoEstado, 'En revisión');
    assert.equal(ok.cuerpo.datos.pagos.length, 1);
    t.numero = ok.cuerpo.datos.numero;
  });

  test('mientras el pago está en revisión la cotización no cambia', async () => {
    const r = await e.api(`/cotizaciones/${t.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Aprobada' } });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /pendiente de confirmación/);
  });

  test('rechazado: exige motivo, avisa al cliente y bloquea la cotización', async () => {
    const sinMotivo = await e.api(`/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Rechazado' },
    });
    assert.equal(sinMotivo.estado, 422);

    const rechazo = await e.api(`/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Rechazado', motivo: 'La consignación no aparece' },
    });
    assert.equal(rechazo.estado, 200);
    assert.equal(rechazo.cuerpo.datos.pagoEstado, 'Rechazado');

    const avisos = await e.api('/portal/notificaciones', { token: t.luis });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo === `Pago rechazado · ${t.numero}`));

    const cambio = await e.api(`/cotizaciones/${t.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Aprobada' } });
    assert.equal(cambio.estado, 422);
  });

  test('el cliente vuelve a subir el pago y queda el historial (el más nuevo primero)', async () => {
    const r = await e.api(`/portal/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { medioPago: 'Transferencia', comprobante: PNG },
    });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.pagoEstado, 'En revisión');
    assert.deepEqual(
      r.cuerpo.datos.pagos.map((p) => p.estado),
      ['En revisión', 'Rechazado'],
    );

    // No puede volver a subirlo mientras está en revisión
    const otraVez = await e.api(`/portal/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { medioPago: 'Efectivo' },
    });
    assert.equal(otraVez.estado, 422);

    // El portal también trae el historial
    const portal = await e.api('/portal/resumen', { token: t.luis });
    const enPortal = portal.cuerpo.datos.cotizaciones.find((c) => c.numero === t.numero);
    assert.equal(enPortal.pagos.length, 2);
  });

  test('aprobado, la cotización sigue su proceso normal', async () => {
    const r = await e.api(`/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Aprobado' },
    });
    assert.equal(r.cuerpo.datos.pagoEstado, 'Aprobado');
    const cambio = await e.api(`/cotizaciones/${t.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Aprobada' } });
    assert.equal(cambio.estado, 200);
  });
});

describe('Datos que no se repiten entre cuentas', () => {
  const registro = (cambios) =>
    e.api('/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: 'Persona Nueva',
        tipoDocumento: 'CC',
        numeroDocumento: '70707070',
        telefono: '3157778899',
        correo: 'persona.nueva@ejemplo.com',
        password: 'ClaveSegura2026',
        ...cambios,
      },
    });

  test('un correo, documento o teléfono repetido no revela cuál existe', async () => {
    for (const cambio of [
      { correo: 'MARIA@gmail.com' },
      { numeroDocumento: '52678901' }, // documento de una cuenta del personal
      { telefono: '311 987 6543' }, // teléfono de María, con espacios
    ]) {
      const r = await registro(cambio);
      assert.equal(r.estado, 409, JSON.stringify(cambio));
      assert.equal(r.cuerpo.error, 'No pudimos crear tu usuario.');
      assert.equal(r.cuerpo.detalles, undefined);
    }
    assert.equal((await registro()).estado, 201, 'con datos nuevos sí se crea');
  });

  test('el administrador tampoco puede repetirlos', async () => {
    const roles = await e.api('/roles', { token: t.admin });
    const asesor = roles.cuerpo.datos.find((r) => r.nombre === 'Asesor de ventas');
    const r = await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Copia',
        tipoDocumento: 'CC',
        numeroDocumento: '12121212',
        correo: 'otra@mirallantas.com',
        telefono: '3001112233', // el del administrador
        rolId: asesor.id,
        password: 'ClaveSegura2026',
      },
    });
    assert.equal(r.estado, 409);
    assert.doesNotMatch(r.cuerpo.error, /teléfono|correo|documento/i);
  });
});

describe('Administrador principal', () => {
  test('no se puede desactivar, cambiar de rol ni eliminar', async () => {
    const usuarios = await e.api('/usuarios', { token: t.admin });
    const principal = usuarios.cuerpo.datos.find((u) => u.principal);
    assert.equal(principal.correo, 'admin@mirallantas.com');
    assert.equal(usuarios.cuerpo.datos.filter((u) => u.principal).length, 1);

    // Otro administrador intenta desactivarlo
    const roles = await e.api('/roles', { token: t.admin });
    const rolAdmin = roles.cuerpo.datos.find((r) => r.nombre === 'Administrador');
    const segundo = await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Segunda Admin',
        tipoDocumento: 'CC',
        numeroDocumento: '45454545',
        correo: 'segunda@mirallantas.com',
        rolId: rolAdmin.id,
        password: 'ClaveSegura2026',
      },
    });
    assert.equal(segundo.estado, 201, JSON.stringify(segundo.cuerpo));
    const otraAdmin = await e.iniciarSesion('segunda@mirallantas.com', 'ClaveSegura2026');

    for (const cuerpo of [{ activo: false }, { rolId: roles.cuerpo.datos.find((r) => r.nombre === 'Cliente').id }]) {
      const r = await e.api(`/usuarios/${principal.id}`, { metodo: 'PUT', token: otraAdmin, cuerpo });
      assert.equal(r.estado, 422, JSON.stringify(cuerpo));
    }
    assert.equal((await e.api(`/usuarios/${principal.id}`, { metodo: 'DELETE', token: otraAdmin })).estado, 422);

    // A los demás sí se les cambia el estado, y uno inactivo no entra
    const r = await e.api(`/usuarios/${segundo.cuerpo.datos.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: false } });
    assert.equal(r.estado, 200);
    const login = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'segunda@mirallantas.com', password: 'ClaveSegura2026' },
    });
    assert.equal(login.cuerpo.codigo, 'CUENTA_INACTIVA');
  });
});
