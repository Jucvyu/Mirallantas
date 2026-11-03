import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { aceptar, cotizacionEmitida } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de la regla "todo abono confirmado cuenta como venta" (en Ventas y
 * en el tablero), de la cuota inicial que espera la aprobación del crédito y
 * de la tabla única de métodos de pago.
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

const post = (ruta, cuerpo, token = t.admin) => e.api(ruta, { metodo: 'POST', token, cuerpo });
const patch = (ruta, cuerpo, token = t.admin) => e.api(ruta, { metodo: 'PATCH', token, cuerpo });
const obtener = async (ruta) => (await e.api(ruta, { token: t.admin })).cuerpo.datos;
const ventasDelMes = async () => Number((await obtener('/dashboard')).ventasMes.total);

/** Salda los créditos de Luis: solo se permite uno abierto por cliente. */
const saldarCreditos = () =>
  e.db.query("UPDATE credito SET saldo_pendiente = 0 WHERE cliente_id = (SELECT id FROM cliente WHERE correo = 'lfmora@yahoo.com')");

/** Cotización a crédito de Luis, aceptada, con su solicitud aún pendiente. */
async function cotizacionACredito() {
  await saldarCreditos();
  const numero = await cotizacionEmitida(e, {
    token: t.luis,
    tokenAsesor: t.admin,
    lineas: [{ tipo: 'producto', productoId: 1, cantidad: 2 }],
  });
  const aceptada = await aceptar(e, t.luis, numero, { metodoPago: 'Crédito', plazoDias: 30 });
  assert.equal(aceptada.estado, 200, JSON.stringify(aceptada.cuerpo));
  const solicitud = (await e.api(`/solicitudes-credito?q=${numero}`, { token: t.admin })).cuerpo.datos[0].numero;
  return { numero, solicitud };
}

describe('La cuota inicial espera la aprobación del crédito', () => {
  test('con la solicitud pendiente no se paga, ni en el local ni desde el portal', async () => {
    const { numero, solicitud } = await cotizacionACredito();
    Object.assign(t, { numero, solicitud });

    const cotizacion = await obtener(`/cotizaciones/${numero}`);
    assert.equal(cotizacion.estadoSolicitudCredito, 'Pendiente');
    assert.equal(cotizacion.solicitudCredito, solicitud);

    assert.equal((await post(`/cotizaciones/${numero}/cuota`, { medioPago: 'Efectivo' })).estado, 422);
    assert.equal((await post(`/portal/cotizaciones/${numero}/cuota`, { medioPago: 'Efectivo' }, t.luis)).estado, 422);
  });

  test('aprobada, ya se puede registrar', async () => {
    assert.equal((await patch(`/solicitudes-credito/${t.solicitud}`, { estado: 'Aprobada' })).estado, 200);
    const cotizacion = await obtener(`/cotizaciones/${t.numero}`);
    assert.equal(cotizacion.estadoSolicitudCredito, 'Pendiente de cuota inicial');
    assert.equal((await post(`/cotizaciones/${t.numero}/cuota`, { medioPago: 'Efectivo' })).estado, 200);
  });
});

describe('Los abonos confirmados cuentan como ventas', () => {
  test('la cuota inicial confirmada crea la venta y suma en el tablero', async () => {
    const antes = await ventasDelMes();
    assert.equal((await post(`/cotizaciones/${t.numero}/pago`, { estado: 'Aprobado' })).estado, 200);

    const { venta, cuotaInicial, total } = await obtener(`/cotizaciones/${t.numero}`);
    assert.ok(cuotaInicial > 0 && cuotaInicial < total);
    t.venta = venta;
    t.cuotaInicial = cuotaInicial;
    assert.equal((await obtener(`/ventas/${venta}`)).total, cuotaInicial, 'la venta vale lo cobrado');
    assert.equal(await ventasDelMes(), antes + cuotaInicial);
  });

  test('cada abono confirmado sube la venta; pendiente o rechazado no cuenta', async () => {
    const antes = await ventasDelMes();
    const { credito, numero: venta } = await obtener(`/ventas/${t.venta}`);

    const abono = await post(`/creditos/${credito}/abonos`, { monto: 50000, medioPago: 'Efectivo' }, t.luis);
    assert.equal(abono.estado, 201);
    assert.equal((await obtener(`/ventas/${venta}`)).total, t.cuotaInicial, 'pendiente: todavía no');
    assert.equal(await ventasDelMes(), antes);

    assert.equal((await patch(`/abonos/${abono.cuerpo.datos.numero}`, { estado: 'Confirmado' })).estado, 200);
    assert.equal((await obtener(`/ventas/${venta}`)).total, t.cuotaInicial + 50000);
    assert.equal(await ventasDelMes(), antes + 50000);

    // Se confirmó por error: el dinero sale de la venta y del tablero
    assert.equal((await patch(`/abonos/${abono.cuerpo.datos.numero}`, { estado: 'Rechazado', motivo: 'Se confirmó por error' })).estado, 200);
    assert.equal((await obtener(`/ventas/${venta}`)).total, t.cuotaInicial);
    assert.equal(await ventasDelMes(), antes);
  });

  test('una línea sin precio ya no deja el abono por fuera de las ventas', async () => {
    const { numero, solicitud } = await cotizacionACredito();
    assert.equal((await patch(`/solicitudes-credito/${solicitud}`, { estado: 'Aprobada' })).estado, 200);
    await e.db.query(
      `UPDATE cotizacion_detalle SET precio_unitario = NULL, subtotal = NULL
        WHERE id = (SELECT d.id FROM cotizacion_detalle d JOIN cotizacion c ON c.id = d.cotizacion_id WHERE c.numero = $1 LIMIT 1)`,
      [numero],
    );

    assert.equal((await post(`/cotizaciones/${numero}/cuota`, { medioPago: 'Efectivo' })).estado, 200);
    assert.equal((await post(`/cotizaciones/${numero}/pago`, { estado: 'Aprobado' })).estado, 200);

    const { venta, cuotaInicial } = await obtener(`/cotizaciones/${numero}`);
    assert.match(venta ?? '', /^VEN-/);
    assert.equal((await obtener(`/ventas/${venta}`)).total, cuotaInicial);
  });

  test('un crédito sin cotización también genera venta, que crece con sus abonos', async () => {
    await saldarCreditos();
    const creada = await post('/solicitudes-credito', { monto: 200000, plazoDias: 30 }, t.luis);
    assert.equal(creada.estado, 201, JSON.stringify(creada.cuerpo));
    assert.equal((await patch(`/solicitudes-credito/${creada.cuerpo.datos.numero}`, { estado: 'Aprobada' })).estado, 200);

    const [factura] = (await e.api('/abonos/facturas', { token: t.admin })).cuerpo.datos.filter((f) => f.saldoPendiente === 200000);
    assert.ok(factura, 'la venta del crédito admite abonos del asesor');
    assert.equal(factura.total, 0);

    assert.equal((await post('/abonos', { factura: factura.numero, monto: 80000, medioPago: 'Efectivo' })).estado, 201);
    assert.equal((await obtener(`/ventas/${factura.numero}`)).total, 80000);
  });
});

describe('Ventas por marca', () => {
  test('suman lo cobrado: la cuota y los abonos confirmados, no el valor de los productos', async () => {
    const { ventasPorMarca } = await import('../src/models/dashboard.model.js');
    const { rows } = await e.db.query('SELECT m.nombre FROM producto p JOIN marca m ON m.id = p.marca_id WHERE p.id = 1');
    const cobradoDeLaMarca = async () => (await ventasPorMarca()).find((f) => f.marca === rows[0].nombre)?.vendido ?? 0;

    const { numero, solicitud } = await cotizacionACredito();
    assert.equal((await patch(`/solicitudes-credito/${solicitud}`, { estado: 'Aprobada' })).estado, 200);
    assert.equal((await post(`/cotizaciones/${numero}/cuota`, { medioPago: 'Efectivo' })).estado, 200);

    const antes = await cobradoDeLaMarca();
    assert.equal((await post(`/cotizaciones/${numero}/pago`, { estado: 'Aprobado' })).estado, 200);
    const { cuotaInicial, venta } = await obtener(`/cotizaciones/${numero}`);
    const trasCuota = await cobradoDeLaMarca();
    assert.ok(Math.abs(trasCuota - antes - cuotaInicial) <= 1, 'la cuota inicial cuenta completa');

    const { credito } = await obtener(`/ventas/${venta}`);
    const abono = await post(`/creditos/${credito}/abonos`, { monto: 50000, medioPago: 'Efectivo' }, t.luis);
    assert.equal(await cobradoDeLaMarca(), trasCuota, 'un abono pendiente no cuenta');

    assert.equal((await patch(`/abonos/${abono.cuerpo.datos.numero}`, { estado: 'Confirmado' })).estado, 200);
    assert.ok(Math.abs((await cobradoDeLaMarca()) - trasCuota - 50000) <= 1, 'el abono confirmado suma');
  });
});

describe('Una sola tabla de métodos de pago', () => {
  test('la tabla medio_pago ya no existe y las listas salen de metodo_pago', async () => {
    const { rows } = await e.db.query("SELECT to_regclass('medio_pago') AS tabla");
    assert.equal(rows[0].tabla, null);

    const listas = (await e.api('/referencias')).cuerpo;
    assert.deepEqual(listas.metodosPago, ['Contado', 'Crédito']);
    assert.ok(listas.mediosPago.includes('Efectivo') && listas.mediosPago.includes('Transferencia'));
    assert.ok(!listas.mediosPago.includes('Tarjeta'), 'un método inactivo no se ofrece');
  });

  test('un abono no se paga con "Contado"', async () => {
    const [factura] = (await e.api('/abonos/facturas', { token: t.admin })).cuerpo.datos;
    const r = await post('/abonos', { factura: factura.numero, monto: factura.saldoPendiente, medioPago: 'Contado' });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /método de pago/);
  });
});
