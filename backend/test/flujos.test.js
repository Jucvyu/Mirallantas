import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { aceptar, cotizacionEmitida, emitir, PNG, solicitud } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de los flujos completos del negocio: solicitud → cotización
 * formal → aceptación → crédito → venta → abono, compras, registro de
 * clientes y tableros.
 */

let e;
const t = {};
const anio = new Date().getFullYear();

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.maria = await e.iniciarSesion('maria@gmail.com'); // tiene un crédito abierto
  t.luis = await e.iniciarSesion('lfmora@yahoo.com'); // no tiene créditos
});

after(async () => {
  await e?.cerrar();
});

/** Solicitud de Luis: 2 llantas (catálogo: $ 280.000) y un reencauche. */
const lineasLuis = [
  { tipo: 'producto', productoId: 1, cantidad: 2 },
  { tipo: 'servicio', cantidad: 1, medidas: '295/80R22.5', descripcion: 'Carcasa sana', foto: PNG },
];

const credito = (cuotaInicial) => ({ metodoPago: 'Crédito', plazoDias: 30, ...(cuotaInicial ? { cuotaInicial } : {}) });

describe('Solicitud de cotización desde el portal', () => {
  test('se registra sin precios ni método de pago y abre las solicitudes de reencauche', async () => {
    const r = await e.api('/cotizaciones', { metodo: 'POST', token: t.luis, cuerpo: solicitud(lineasLuis) });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const c = r.cuerpo.datos;
    assert.equal(c.numero, `PED-${anio}-001`);
    assert.equal(c.etapa, 'Solicitud');
    assert.equal(c.metodoPago, null);
    assert.equal(c.total, 0);
    assert.equal(c.detalle[0].precioUnitario, null, 'el precio de la llanta está por confirmar');
    assert.ok(!('precioSugerido' in c.detalle[0]) && !('costoProveedor' in c.detalle[0]), 'nada interno al cliente');
    assert.equal(c.detalle[1].tipo, 'servicio');
    assert.match(c.detalle[1].solicitudServicio, /^SOL-/);
    t.cotizacionLuis = c.numero;

    // El personal de Pedidos-Cotización recibe el aviso
    const avisos = await e.api('/notificaciones', { token: t.admin });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo === 'Nueva solicitud de cotización'));
  });

  test('una misma llanta pedida dos veces queda en una sola línea', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: solicitud(
        [
          { tipo: 'producto', productoId: 3, cantidad: 1 },
          { tipo: 'producto', productoId: 3, cantidad: 2 },
        ],
        { clienteId: 1 },
      ),
    });
    assert.equal(r.estado, 201);
    assert.equal(r.cuerpo.datos.detalle.length, 1);
    assert.equal(r.cuerpo.datos.detalle[0].cantidad, 3);
  });

  test('una solicitud no se acepta, no avanza y no tiene PDF', async () => {
    const aceptarla = await aceptar(e, t.luis, t.cotizacionLuis, { metodoPago: 'Contado', pago: { medioPago: 'Efectivo' } });
    assert.equal(aceptarla.estado, 422);
    assert.match(aceptarla.cuerpo.error, /confirmando los precios/);

    const avanzar = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Aprobada' } });
    assert.equal(avanzar.estado, 422);
    assert.match(avanzar.cuerpo.error, /emite la cotización formal/);

    assert.equal((await e.api(`/cotizaciones/${t.cotizacionLuis}/pdf`, { token: t.luis })).estado, 422);
  });

  test('el cliente no puede emitir ni cambiar el estado de su cotización', async () => {
    const emision = await e.api(`/cotizaciones/${t.cotizacionLuis}/emitir`, { metodo: 'POST', token: t.luis, cuerpo: { lineas: [] } });
    assert.equal(emision.estado, 403);
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { metodo: 'PATCH', token: t.luis, cuerpo: { estado: 'Aprobada' } });
    assert.equal(r.estado, 403);
  });
});

describe('Cotización formal: precios confirmados con el proveedor', () => {
  test('exige el costo confirmado de cada llanta y que el precio no quede por debajo', async () => {
    const detalle = (await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.admin })).cuerpo.datos.detalle;
    const llanta = detalle.find((l) => l.tipo === 'producto');
    t.lineaLuis = llanta.id;
    assert.equal(llanta.costoConfirmadoEn, null, 'todavía no hay un costo confirmado');

    const emitirCon = (lineas) => e.api(`/cotizaciones/${t.cotizacionLuis}/emitir`, { metodo: 'POST', token: t.admin, cuerpo: { lineas } });
    assert.equal((await emitirCon([])).estado, 422);
    const sinCosto = await emitirCon([{ id: llanta.id, proveedorId: 1, precioUnitario: 280000 }]);
    assert.equal(sinCosto.estado, 422);
    const conPerdida = await emitirCon([{ id: llanta.id, proveedorId: 1, costoProveedor: 300000, precioUnitario: 280000 }]);
    assert.equal(conPerdida.estado, 422);
    assert.match(conPerdida.cuerpo.error, /menor que el costo/);
  });

  test('emitida: guarda los precios, vence a los 8 días y avisa al cliente', async () => {
    const r = await emitir(e, t.admin, t.cotizacionLuis);
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    const c = r.cuerpo.datos;
    assert.equal(c.etapa, 'Emitida');
    assert.equal(c.subtotal, 560000);
    assert.equal(c.total, 560000);
    const linea = c.detalle.find((l) => l.id === t.lineaLuis);
    assert.equal(linea.precioUnitario, 280000);
    assert.equal(linea.costoProveedor, 210000);
    assert.ok(linea.costoConfirmadoEn, 'queda la fecha de confirmación');

    const { rows } = await e.db.query(
      "SELECT vence_en - emitida_en AS dias, emitida_en = CURRENT_DATE AS hoy FROM cotizacion WHERE numero = $1",
      [t.cotizacionLuis],
    );
    assert.equal(rows[0].dias, 8);
    assert.equal(rows[0].hoy, true, 'la fecha la pone el servidor');

    const avisos = await e.api('/portal/notificaciones', { token: t.luis });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.startsWith('Tu cotización está lista')));
  });

  test('el cliente ve los precios pero no el costo del proveedor', async () => {
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.luis });
    const linea = r.cuerpo.datos.detalle.find((l) => l.tipo === 'producto');
    assert.equal(linea.precioUnitario, 280000);
    assert.ok(!('costoProveedor' in linea) && !('proveedorLinea' in linea) && !('ultimoCosto' in linea));
  });

  test('si cambia el precio del catálogo, la cotización emitida no cambia', async () => {
    await e.api('/productos/1', { metodo: 'PUT', token: t.admin, cuerpo: { precioVenta: 999000 } });
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.admin });
    assert.equal(r.cuerpo.datos.subtotal, 560000);
    await e.api('/productos/1', { metodo: 'PUT', token: t.admin, cuerpo: { precioVenta: 280000 } });
  });

  test('genera el PDF de la cotización formal', async () => {
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}/pdf`, { token: t.luis });
    assert.equal(r.estado, 200);
    assert.match(r.tipo, /application\/pdf/);
    assert.equal(r.bytes.subarray(0, 4).toString(), '%PDF');
  });
});

describe('Aceptación de la cotización formal', () => {
  test('a crédito exige la cuota inicial del 30 % y su comprobante', async () => {
    const sinCuota = await aceptar(e, t.luis, t.cotizacionLuis, credito());
    assert.equal(sinCuota.estado, 422);
    assert.match(sinCuota.cuerpo.error, /cuota inicial/);

    const baja = await aceptar(e, t.luis, t.cotizacionLuis, credito({ monto: 1000, medioPago: 'Efectivo' }));
    assert.equal(baja.estado, 422);
    assert.match(baja.cuerpo.error, /30 %/);

    const sinComprobante = await aceptar(e, t.luis, t.cotizacionLuis, credito({ monto: 500000, medioPago: 'Transferencia' }));
    assert.equal(sinComprobante.estado, 422);
    assert.match(sinComprobante.cuerpo.error, /comprobante/);
  });

  test('desde el portal no se paga con tarjeta', async () => {
    const r = await aceptar(e, t.luis, t.cotizacionLuis, credito({ monto: 500000, medioPago: 'Tarjeta', comprobante: PNG }));
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /efectivo o transferencia/);
  });

  test('a crédito suma el interés y abre la solicitud por lo que se financia', async () => {
    // 560.000 + 3 % = 576.800; la cuota mínima es 173.040 (30 %)
    const r = await aceptar(e, t.luis, t.cotizacionLuis, credito({ monto: 500000, medioPago: 'Transferencia', comprobante: PNG }));
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.etapa, 'Aceptada');
    assert.equal(r.cuerpo.datos.interes, 16800);
    assert.equal(r.cuerpo.datos.total, 576800);

    const solicitudes = await e.api(`/solicitudes-credito?q=${t.cotizacionLuis}`, { token: t.admin });
    const solicitudCredito = solicitudes.cuerpo.datos[0];
    assert.equal(solicitudCredito.estado, 'Pendiente');
    assert.equal(solicitudCredito.monto, 576800 - 500000);
    t.solicitudLuis = solicitudCredito.numero;

    // Ya aceptada, no se vuelve a emitir con otros precios
    assert.equal((await emitir(e, t.admin, t.cotizacionLuis)).estado, 422);
  });

  test('con un crédito abierto no se acepta otra cotización a crédito', async () => {
    const { rows } = await e.db.query("SELECT cliente_id FROM usuario WHERE correo = 'maria@gmail.com'");
    const numero = await cotizacionEmitida(e, {
      token: t.admin,
      tokenAsesor: t.admin,
      lineas: [{ tipo: 'producto', productoId: 2, cantidad: 1 }],
      extra: { clienteId: rows[0].cliente_id },
    });
    const r = await aceptar(e, t.maria, numero, credito({ monto: 400000, medioPago: 'Efectivo' }));
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /solo se permite uno/);
  });

  test('una cotización vencida no se acepta', async () => {
    const numero = await cotizacionEmitida(e, {
      token: t.luis,
      tokenAsesor: t.admin,
      lineas: [{ tipo: 'producto', productoId: 4, cantidad: 1 }],
    });
    await e.db.query("UPDATE cotizacion SET emitida_en = CURRENT_DATE - 9, vence_en = CURRENT_DATE - 1 WHERE numero = $1", [numero]);
    const r = await aceptar(e, t.luis, numero, { metodoPago: 'Contado', pago: { medioPago: 'Efectivo' } });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /venció/);
    // El asesor puede volver a emitirla con precios actualizados
    assert.equal((await emitir(e, t.admin, numero)).cuerpo.datos.etapa, 'Emitida');
  });
});

describe('Cotización a crédito → solicitud → crédito → venta → abono', () => {
  test('no se aprueba desde Pedidos-cotización sino desde su solicitud', async () => {
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Aprobada' },
    });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /Solicitudes de crédito/);
  });

  test('el total ya no se escribe a mano', async () => {
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { metodo: 'PATCH', token: t.admin, cuerpo: { total: 1 } });
    assert.equal(r.estado, 422);
  });

  test('el detalle de la solicitud trae las líneas y la consignación', async () => {
    const r = await e.api(`/solicitudes-credito/${t.solicitudLuis}`, { token: t.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.detalle.length, 2);
    assert.equal(r.cuerpo.datos.cuotaInicial, 500000);
    assert.equal(r.cuerpo.datos.cuotaInicialMedio, 'Transferencia');
    assert.ok(r.cuerpo.datos.comprobante, 'trae la consignación');

    // El cliente ve la suya; otro cliente no
    assert.equal((await e.api(`/solicitudes-credito/${t.solicitudLuis}`, { token: t.luis })).estado, 200);
    assert.equal((await e.api(`/solicitudes-credito/${t.solicitudLuis}`, { token: t.maria })).estado, 404);
  });

  test('al aprobarla se abre el crédito y la cuota inicial queda como abono', async () => {
    const r = await e.api(`/solicitudes-credito/${t.solicitudLuis}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Aprobada' },
    });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));

    // Aparece en la cartera del cliente con lo que queda debiendo
    const creditos = await e.api('/creditos', { token: t.luis });
    const credito = creditos.cuerpo.datos.find((c) => c.cotizacion === t.cotizacionLuis);
    assert.equal(credito.montoTotal, 576800);
    assert.equal(credito.saldoPendiente, 76800);
    t.credito = credito.numero;

    const detalle = await e.api(`/creditos/${t.credito}`, { token: t.admin });
    assert.ok(detalle.cuerpo.datos.abonos.some((a) => a.monto === 500000 && a.estado === 'Confirmado'));

    const cotizacion = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.admin });
    assert.equal(cotizacion.cuerpo.datos.estado, 'Aprobada');
  });

  test('con el servicio sin pagar no avanza; pagado, el valor se suma y el pago queda aprobado', async () => {
    const frenada = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'En proceso' } });
    assert.equal(frenada.estado, 422);
    assert.match(frenada.cuerpo.error, /pagos pendientes/);

    const antes = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.admin });
    assert.equal(antes.cuerpo.datos.estadoPago, 'Pendiente');
    const solicitud = antes.cuerpo.datos.detalle.find((l) => l.solicitudServicio).solicitudServicio;

    // El asesor le pone valor al servicio y el cliente lo paga en el local
    const precio = await e.api(`/solicitudes-servicio/${solicitud}`, { metodo: 'PATCH', token: t.admin, cuerpo: { precio: 90000 } });
    assert.equal(precio.estado, 200, JSON.stringify(precio.cuerpo));
    const pago = await e.api(`/solicitudes-servicio/${solicitud}/pago`, { metodo: 'POST', token: t.admin, cuerpo: { estado: 'Aprobado' } });
    assert.equal(pago.estado, 200, JSON.stringify(pago.cuerpo));

    const despues = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.admin });
    assert.equal(despues.cuerpo.datos.totalServicios, 90000);
    assert.equal(despues.cuerpo.datos.estadoPago, 'Aprobado');
  });

  test('al completarla genera la venta con las mismas líneas', async () => {
    for (const estado of ['En proceso', 'Completada']) {
      const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado } });
      assert.equal(r.estado, 200, `${estado}: ${JSON.stringify(r.cuerpo)}`);
    }
    const cotizacion = await e.api(`/cotizaciones/${t.cotizacionLuis}`, { token: t.admin });
    assert.match(cotizacion.cuerpo.datos.venta, /^VEN-/);

    const venta = await e.api(`/ventas/${cotizacion.cuerpo.datos.venta}`, { token: t.admin });
    assert.equal(venta.cuerpo.datos.total, 576800);
    assert.equal(venta.cuerpo.datos.detalle.length, 2);

    const credito = await e.api(`/creditos/${t.credito}`, { token: t.admin });
    assert.equal(credito.cuerpo.datos.venta, cotizacion.cuerpo.datos.venta, 'el crédito queda ligado a la venta');
  });

  test('el cliente abona a su crédito y no a uno ajeno', async () => {
    const ajeno = await e.api('/creditos/CRE-002/abonos', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { monto: 1000, medioPago: 'Efectivo' },
    });
    assert.equal(ajeno.estado, 404);

    const excede = await e.api(`/creditos/${t.credito}/abonos`, {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { monto: 999999, medioPago: 'Efectivo' },
    });
    assert.equal(excede.estado, 422);

    const ok = await e.api(`/creditos/${t.credito}/abonos`, {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { monto: 50000, medioPago: 'Efectivo' },
    });
    assert.equal(ok.estado, 201);
    assert.equal(ok.cuerpo.datos.estado, 'Pendiente');
    t.abono = ok.cuerpo.datos.numero;
  });

  test('al confirmar el abono baja el saldo del crédito, una sola vez', async () => {
    const r = await e.api(`/abonos/${t.abono}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Confirmado' } });
    assert.equal(r.estado, 200);

    const credito = await e.api(`/creditos/${t.credito}`, { token: t.admin });
    assert.equal(credito.cuerpo.datos.saldoPendiente, 26800);

    // Un abono confirmado no vuelve a cambiar de estado
    const otraVez = await e.api(`/abonos/${t.abono}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Rechazado' } });
    assert.equal(otraVez.estado, 422);
  });

  test('con el crédito abierto no puede solicitar otro', async () => {
    const r = await e.api('/solicitudes-credito', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: { monto: 100000, plazoDias: 30 },
    });
    assert.equal(r.estado, 422);
  });

  test('si no se aprueba, la cotización se rechaza', async () => {
    // Un cliente activo sin crédito abierto ni solicitudes pendientes
    const { rows } = await e.db.query(`
      SELECT c.id FROM cliente c
       WHERE c.activo AND c.correo <> 'lfmora@yahoo.com'
         AND NOT EXISTS (SELECT 1 FROM credito cr WHERE cr.cliente_id = c.id AND cr.saldo_pendiente > 0)
         AND NOT EXISTS (SELECT 1 FROM solicitud_credito s WHERE s.cliente_id = c.id AND s.estado = 'Pendiente')
       ORDER BY c.id LIMIT 1`);
    const numero = await cotizacionEmitida(e, {
      token: t.admin,
      tokenAsesor: t.admin,
      lineas: [{ tipo: 'producto', productoId: 2, cantidad: 1 }],
      extra: { clienteId: rows[0].id, direccionEntrega: 'Cra 30 #25-90, Bogotá' },
    });
    // El asesor registra la aceptación en el local (cuota en efectivo)
    const aceptada = await aceptar(e, t.admin, numero, credito({ monto: 400000, medioPago: 'Efectivo' }), { desdePortal: false });
    assert.equal(aceptada.estado, 200, JSON.stringify(aceptada.cuerpo));

    const solicitudCredito = (await e.api(`/solicitudes-credito?q=${numero}`, { token: t.admin })).cuerpo.datos[0];
    const sinMotivo = await e.api(`/solicitudes-credito/${solicitudCredito.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Rechazada' },
    });
    assert.equal(sinMotivo.estado, 422, 'no aprobar exige el motivo');

    const rechazo = await e.api(`/solicitudes-credito/${solicitudCredito.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Rechazada', motivo: 'Sin respaldo' },
    });
    assert.equal(rechazo.estado, 200);
    const cotizacion = await e.api(`/cotizaciones/${numero}`, { token: t.admin });
    assert.equal(cotizacion.cuerpo.datos.estado, 'Rechazada');
  });
});

describe('Compras', () => {
  test('no abastece una cotización pendiente', async () => {
    const r = await e.api('/compras', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        proveedorId: 1,
        cotizacion: 'PED-2024-005',
        lineas: [{ productoId: 5, cantidad: 4, precioUnitario: 468000, origen: 'Cotización' }],
      },
    });
    assert.equal(r.estado, 422);
  });

  test('registra la compra de una cotización en proceso con un producto adicional', async () => {
    const r = await e.api('/compras', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        proveedorId: 1,
        cotizacion: 'PED-2024-002',
        lineas: [
          { productoId: 1, cantidad: 2, precioUnitario: 218000, origen: 'Cotización' },
          { productoId: 2, cantidad: 1, precioUnitario: 342000, origen: 'Adicional' },
        ],
      },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.total, 778000);
    assert.equal(r.cuerpo.datos.detalle.length, 2);

    // Al anularla, la entrega se cancela
    const anulada = await e.api(`/compras/${r.cuerpo.datos.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Anulada' },
    });
    assert.equal(anulada.cuerpo.datos.estadoEntrega, 'Cancelado');
  });

  test('recibida y entregada, la compra guarda el último costo (no maneja stock)', async () => {
    const r = await e.api('/compras', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { proveedorId: 1, lineas: [{ productoId: 3, cantidad: 5, precioUnitario: 200000, origen: 'Adicional' }] },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.ok(!('stockAplicado' in r.cuerpo.datos));
    const cambiar = (cuerpo) => e.api(`/compras/${r.cuerpo.datos.numero}`, { metodo: 'PATCH', token: t.admin, cuerpo });
    await cambiar({ estado: 'Recibida' });
    await cambiar({ estadoEntrega: 'En camino' });
    await cambiar({ estadoEntrega: 'Entregado' });
    const { rows } = await e.db.query('SELECT precio_compra FROM producto WHERE id = 3');
    assert.equal(Number(rows[0].precio_compra), 200000, 'guarda el último precio de compra');
  });

  test('la compra muestra si el costo de la llanta se confirmó con el proveedor', async () => {
    // Cotización de contado aceptada, pagada y aprobada
    const numero = await cotizacionEmitida(e, {
      token: t.admin,
      tokenAsesor: t.admin,
      lineas: [{ tipo: 'producto', productoId: 1, cantidad: 2 }],
      extra: { clienteId: 1 },
    });
    await aceptar(e, t.admin, numero, { metodoPago: 'Contado', pago: { medioPago: 'Efectivo' } }, { desdePortal: false });
    await e.api(`/cotizaciones/${numero}/pago`, { metodo: 'POST', token: t.admin, cuerpo: { estado: 'Aprobado' } });
    const aprobada = await e.api(`/cotizaciones/${numero}`, { metodo: 'PATCH', token: t.admin, cuerpo: { estado: 'Aprobada' } });
    assert.equal(aprobada.estado, 200, JSON.stringify(aprobada.cuerpo));

    const r = await e.api('/compras', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        proveedorId: 1,
        cotizacion: numero,
        lineas: [
          { productoId: 1, cantidad: 2, precioUnitario: 210000, origen: 'Cotización' },
          { productoId: 2, cantidad: 1, precioUnitario: 342000, origen: 'Adicional' },
        ],
      },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const [confirmada, adicional] = r.cuerpo.datos.detalle;
    assert.equal(confirmada.costoConfirmado, 210000);
    assert.ok(confirmada.costoConfirmadoEn);
    assert.equal(adicional.costoConfirmado, null, 'precio sin confirmar');
  });

  test('un cliente del portal no ve compras', async () => {
    assert.equal((await e.api('/compras', { token: t.luis })).estado, 403);
  });
});

describe('Registro, perfil y tableros', () => {
  test('el registro no se liga a un documento que ya existe', async () => {
    const r = await e.api('/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: 'Suplantador',
        tipoDocumento: 'CC',
        numeroDocumento: '1024567890', // documento de María
        telefono: '3000000000',
        correo: 'otro@ejemplo.com',
        password: 'clave-segura-1',
      },
    });
    assert.equal(r.estado, 409);
  });

  test('un cliente nuevo se registra y queda con sesión', async () => {
    const r = await e.api('/auth/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: 'Cliente Nuevo',
        tipoDocumento: 'CC',
        numeroDocumento: '55555555',
        telefono: '3001234567',
        correo: 'nuevo@ejemplo.com',
        password: 'clave-segura-1',
      },
    });
    assert.equal(r.estado, 201);
    assert.equal(r.cuerpo.usuario.rol, 'Cliente');
    assert.ok(r.cuerpo.usuario.clienteId);
    assert.ok(r.cuerpo.token);
  });

  test('el perfil se actualiza pero el rol no cambia', async () => {
    const r = await e.api('/auth/yo', {
      metodo: 'PUT',
      token: t.luis,
      cuerpo: { telefono: '3109998877', rol: 'Administrador' },
    });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.usuario.telefono, '3109998877');
    assert.equal(r.cuerpo.usuario.rol, 'Cliente');
  });

  test('el resumen del portal trae las cotizaciones con sus líneas', async () => {
    const r = await e.api('/portal/resumen', { token: t.luis });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.esCliente, true);
    assert.ok(r.cuerpo.datos.cotizaciones.every((c) => Array.isArray(c.detalle)));
    assert.equal(r.cuerpo.datos.estadisticas.saldoCredito, 26800);
  });

  test('el tablero se calcula con datos reales', async () => {
    const r = await e.api('/dashboard', { token: t.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.reencauchesPorMes.length, 7);
    assert.equal(r.cuerpo.datos.ultimosPedidos.length, 5);
    // La venta generada este mes cuenta en las ventas del mes
    assert.ok(r.cuerpo.datos.ventasMes.total >= 576800);
  });
});
