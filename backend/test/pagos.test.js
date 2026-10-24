import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { aceptar, cotizacionEmitida, PNG } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas del pago de contado de una cotización (consignación, revisión,
 * rechazo e historial), de los datos que no se repiten entre cuentas y del
 * administrador principal.
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

const contado = (pago) => ({ metodoPago: 'Contado', ...(pago ? { pago } : {}) });

describe('Pago de contado de una cotización', () => {
  test('al aceptarla pide cómo se paga y la consignación (salvo en efectivo)', async () => {
    t.numero = await cotizacionEmitida(e, {
      token: t.luis,
      tokenAsesor: t.admin,
      lineas: [{ tipo: 'producto', productoId: 1, cantidad: 1 }],
    });
    assert.equal((await aceptar(e, t.luis, t.numero, contado())).estado, 422);
    assert.equal((await aceptar(e, t.luis, t.numero, contado({ medioPago: 'Transferencia' }))).estado, 422);
    // Desde el portal ya no se ofrece tarjeta ni "Otro"
    for (const medioPago of ['Tarjeta', 'Otro']) {
      const r = await aceptar(e, t.luis, t.numero, contado({ medioPago, comprobante: PNG }));
      assert.equal(r.estado, 422, medioPago);
    }

    const ok = await aceptar(e, t.luis, t.numero, contado({ medioPago: 'Transferencia', comprobante: PNG }));
    assert.equal(ok.estado, 200, JSON.stringify(ok.cuerpo));
    assert.equal(ok.cuerpo.datos.pagoEstado, 'En revisión');
    assert.equal(ok.cuerpo.datos.estadoPago, 'Pendiente');
    assert.equal(ok.cuerpo.datos.pagos.length, 1);
    assert.equal(ok.cuerpo.datos.pagos[0].monto, 280000, 'de contado se paga el 100 %');
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

  test('aprobado el pago, la cotización queda Aprobada sola', async () => {
    const r = await e.api(`/cotizaciones/${t.numero}/pago`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { estado: 'Aprobado' },
    });
    assert.equal(r.cuerpo.datos.pagoEstado, 'Aprobado');
    // Con el pago aprobado queda "Aprobada" sola, sin que el asesor la cambie
    assert.equal(r.cuerpo.datos.estado, 'Aprobada');
  });

  test('pagada, aparece su venta pendiente; aprobada, su compra al proveedor', async () => {
    const cotizacion = await e.api(`/cotizaciones/${t.numero}`, { token: t.admin });
    assert.match(cotizacion.cuerpo.datos.venta ?? '', /^VEN-/, 'la venta se registra al aprobar el pago');
    const venta = await e.api(`/ventas/${cotizacion.cuerpo.datos.venta}`, { token: t.admin });
    assert.equal(venta.cuerpo.datos.estado, 'Pendiente');
    assert.equal(venta.cuerpo.datos.total, 280000);

    const compras = await e.api('/compras?porPagina=100', { token: t.admin });
    const deLaCotizacion = compras.cuerpo.datos.filter((c) => c.cotizacion === t.numero);
    assert.ok(deLaCotizacion.length >= 1, 'se genera la compra al proveedor');
    assert.ok(deLaCotizacion.every((c) => c.estado === 'Pendiente'));

    // La venta sigue sola a la cotización: la entrega en camino se ve en ventas
    const enCamino = await e.api(`/cotizaciones/${t.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estadoEntrega: 'En camino' } });
    assert.equal(enCamino.estado, 200, JSON.stringify(enCamino.cuerpo));
    const ventaEnCamino = await e.api(`/ventas/${cotizacion.cuerpo.datos.venta}`, { token: t.admin });
    assert.equal(ventaEnCamino.cuerpo.datos.estadoEntrega, 'En camino');
    const aMano = await e.api(`/ventas/${cotizacion.cuerpo.datos.venta}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Anulada' } });
    assert.equal(aMano.estado, 422, 'su estado no se cambia desde ventas');

    // Volver a pasar por "Aprobada" no duplica nada: completarla deja la misma venta completada
    // (antes se recibe la compra al proveedor: sin eso no se completa)
    for (const c of deLaCotizacion) {
      const r = await e.api(`/compras/${c.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Recibida' } });
      assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    }
    for (const estado of ['En proceso', 'Completada']) {
      const r = await e.api(`/cotizaciones/${t.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado } });
      assert.equal(r.estado, 200, `${estado}: ${JSON.stringify(r.cuerpo)}`);
    }
    const completada = await e.api(`/ventas/${cotizacion.cuerpo.datos.venta}`, { token: t.admin });
    assert.equal(completada.cuerpo.datos.estado, 'Completada');
    const otra = await e.api('/compras?porPagina=100', { token: t.admin });
    assert.equal(otra.cuerpo.datos.filter((c) => c.cotizacion === t.numero).length, deLaCotizacion.length);
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
