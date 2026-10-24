import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { aceptar, cotizacionEmitida, PNG } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas del abono del asesor sobre una factura (venta a crédito): el
 * saldo baja en la misma operación, sin pasarse del saldo, sin duplicarse
 * por un doble envío y sin dejar datos a medias. También el medio de pago
 * al aceptar una cotización en el local.
 */

let e;
const t = {};
// VEN-2024-001 es una venta a crédito (CRE-001) con saldo en los datos de prueba
const FACTURA = 'VEN-2024-001';

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
});

after(async () => {
  await e?.cerrar();
});

const saldoDe = async (factura) =>
  (
    await e.db.query(
      'SELECT cr.saldo_pendiente FROM credito cr JOIN venta v ON v.id = cr.venta_id WHERE v.numero = $1',
      [factura],
    )
  ).rows[0].saldo_pendiente;

const abonar = (cuerpo, clave) =>
  e.api('/abonos', {
    metodo: 'POST',
    token: t.admin,
    cuerpo,
    cabeceras: clave ? { 'Idempotency-Key': clave } : {},
  });

describe('Facturas que admiten abonos', () => {
  test('lista ventas a crédito con saldo, filtrables por cliente', async () => {
    const todas = await e.api('/abonos/facturas', { token: t.admin });
    assert.equal(todas.estado, 200);
    const factura = todas.cuerpo.datos.find((f) => f.numero === FACTURA);
    assert.ok(factura, 'aparece la venta a crédito con saldo');
    assert.ok(factura.saldoPendiente > 0);
    assert.ok(todas.cuerpo.datos.every((f) => f.saldoPendiente > 0));

    const delCliente = await e.api(`/abonos/facturas?clienteId=${factura.clienteId}`, { token: t.admin });
    assert.ok(delCliente.cuerpo.datos.every((f) => f.clienteId === factura.clienteId));
  });

  test('un cliente del portal no usa estas rutas', async () => {
    assert.equal((await e.api('/abonos/facturas', { token: t.luis })).estado, 403);
  });
});

describe('Abono sobre una factura', () => {
  test('valida la factura, el monto y el comprobante', async () => {
    assert.equal((await abonar({ factura: 'VEN-9999-001', monto: 1000, medioPago: 'Efectivo' })).estado, 422);
    assert.equal((await abonar({ factura: 'cualquiera', monto: 1000, medioPago: 'Efectivo' })).estado, 422);
    assert.equal((await abonar({ factura: FACTURA, monto: 0, medioPago: 'Efectivo' })).estado, 422);
    const sinComprobante = await abonar({ factura: FACTURA, monto: 1000, medioPago: 'Transferencia' });
    assert.equal(sinComprobante.estado, 422);
  });

  test('no puede superar el saldo pendiente', async () => {
    const saldo = await saldoDe(FACTURA);
    const r = await abonar({ factura: FACTURA, monto: saldo + 1, medioPago: 'Efectivo' });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /saldo pendiente/);
    assert.equal(await saldoDe(FACTURA), saldo, 'el saldo no cambió');
  });

  test('registra el abono confirmado y resta el saldo en la misma operación', async () => {
    const antes = await saldoDe(FACTURA);
    const r = await abonar({ factura: FACTURA, monto: 300000, medioPago: 'Transferencia', comprobante: PNG });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, 'Confirmado');
    assert.equal(r.cuerpo.datos.factura, FACTURA);
    assert.equal(await saldoDe(FACTURA), antes - 300000);
  });

  test('un doble envío con la misma clave no registra dos abonos', async () => {
    const antes = await saldoDe(FACTURA);
    const clave = randomUUID();
    const cuerpo = { factura: FACTURA, monto: 20000, medioPago: 'Efectivo' };
    const [a, b] = await Promise.all([abonar(cuerpo, clave), abonar(cuerpo, clave)]);
    assert.equal(a.cuerpo.datos.numero, b.cuerpo.datos.numero);
    assert.equal(await saldoDe(FACTURA), antes - 20000);
  });

  test('el abono mínimo es de $20.000, salvo el último pago por el saldo exacto', async () => {
    const saldo = await saldoDe(FACTURA);
    const pequeno = await abonar({ factura: FACTURA, monto: 5000, medioPago: 'Efectivo' });
    assert.equal(pequeno.estado, 422);
    assert.match(pequeno.cuerpo.error, /mínimo/);
    assert.equal(await saldoDe(FACTURA), saldo, 'no se registró nada');
  });

  test('dos abonos a la vez no dejan el saldo en negativo', async () => {
    const saldo = await saldoDe(FACTURA);
    const cuerpo = { factura: FACTURA, monto: saldo, medioPago: 'Efectivo' };
    const resultados = await Promise.all([abonar(cuerpo), abonar(cuerpo)]);
    assert.deepEqual(resultados.map((r) => r.estado).sort(), [201, 422]);
    assert.equal(await saldoDe(FACTURA), 0);
  });

  test('una factura pagada ya no aparece ni recibe abonos', async () => {
    const r = await abonar({ factura: FACTURA, monto: 1000, medioPago: 'Efectivo' });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /ya está pagada/);
    const facturas = await e.api('/abonos/facturas', { token: t.admin });
    assert.ok(!facturas.cuerpo.datos.some((f) => f.numero === FACTURA));
  });

  test('el historial conserva los abonos anteriores', async () => {
    const r = await e.api('/abonos?q=CRE-001&porPagina=100', { token: t.admin });
    assert.ok(r.cuerpo.datos.filter((a) => a.factura === FACTURA).length >= 3);
  });
});

describe('Aceptación en el local: solo efectivo o transferencia', () => {
  test('el asesor tampoco registra tarjeta ni "otro" al aceptar una cotización', async () => {
    const numero = await cotizacionEmitida(e, {
      token: t.admin,
      tokenAsesor: t.admin,
      lineas: [{ tipo: 'producto', productoId: 3, cantidad: 1 }],
      extra: { clienteId: 1 },
    });
    for (const medioPago of ['Tarjeta', 'Otro']) {
      const r = await aceptar(e, t.admin, numero, { metodoPago: 'Contado', pago: { medioPago, comprobante: PNG } }, { desdePortal: false });
      assert.equal(r.estado, 422, medioPago);
    }
    const ok = await aceptar(e, t.admin, numero, { metodoPago: 'Contado', pago: { medioPago: 'Efectivo' } }, { desdePortal: false });
    assert.equal(ok.estado, 200, JSON.stringify(ok.cuerpo));
  });
});

describe('Comprobante del abono', () => {
  test('se descarga en PDF (tirilla) solo con el abono confirmado', async () => {
    const { rows } = await e.db.query(
      "SELECT (SELECT numero FROM abono WHERE estado = 'Confirmado' LIMIT 1) AS confirmado, (SELECT numero FROM abono WHERE estado <> 'Confirmado' LIMIT 1) AS otro",
    );
    const r = await e.api(`/abonos/${rows[0].confirmado}/pdf`, { token: t.admin });
    assert.equal(r.estado, 200);
    assert.match(r.tipo, /application\/pdf/);
    assert.equal(r.bytes.subarray(0, 4).toString(), '%PDF');
    if (rows[0].otro) assert.equal((await e.api(`/abonos/${rows[0].otro}/pdf`, { token: t.admin })).estado, 422);
  });
});
