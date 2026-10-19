import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de los flujos completos del negocio: cotización → venta →
 * crédito → abono, compras, registro de clientes y tableros.
 */

// Imagen PNG de 1×1 píxel, para los comprobantes
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

/** Stock actual de un producto, directo de la base. */
const stockDe = async (productoId) => (await e.db.query('SELECT stock FROM producto WHERE id = $1', [productoId])).rows[0].stock;

/** Cotización a crédito de Luis: 2 llantas de $ 280.000 a 30 días. */
const cotizacionCredito = (cuotaInicial) => ({
  metodoPago: 'Crédito',
  plazoDias: 30,
  direccionEntrega: 'Cra 5 #10-22, Pereira',
  lineas: [
    { tipo: 'producto', productoId: 1, cantidad: 2 },
    { tipo: 'servicio', cantidad: 1, medidas: '295/80R22.5', descripcion: 'Carcasa sana', foto: PNG },
  ],
  ...(cuotaInicial ? { cuotaInicial } : {}),
});

describe('Cotización desde el portal', () => {
  test('a crédito exige pagar la cuota inicial antes de enviarla', async () => {
    const r = await e.api('/cotizaciones', { metodo: 'POST', token: t.luis, cuerpo: cotizacionCredito() });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /cuota inicial/);
  });

  test('rechaza una cuota inicial menor al 50 % del total', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: cotizacionCredito({ monto: 1000, medioPago: 'Efectivo' }),
    });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /50 %/);
  });

  test('una transferencia exige el comprobante', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: cotizacionCredito({ monto: 500000, medioPago: 'Transferencia' }),
    });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /comprobante/);
  });

  test('sin stock suficiente no se crea el pedido', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: {
        metodoPago: 'Contado',
        direccionEntrega: 'Cra 5',
        lineas: [{ tipo: 'producto', productoId: 1, cantidad: 999 }],
        pago: { medioPago: 'Efectivo' },
      },
    });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /No hay suficientes unidades/);
  });

  test('se crea con precios del servidor, descuenta el stock y abre las solicitudes', async () => {
    t.stockAntes = await stockDe(1);
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.luis,
      cuerpo: cotizacionCredito({ monto: 500000, medioPago: 'Transferencia', comprobante: PNG }),
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const c = r.cuerpo.datos;
    assert.equal(c.numero, `PED-${anio}-001`);
    // 2 × 280.000 = 560.000; +3 % = 576.800. El reencauche no se cobra aquí:
    // el asesor le pone precio en su solicitud y se paga aparte
    assert.equal(c.subtotal, 560000);
    assert.equal(c.interes, 16800);
    assert.equal(c.total, 576800);
    assert.equal(c.detalle[1].subtotal, 0);
    assert.equal(c.confirmado, true, 'el total lo calcula el servidor: no hay que confirmarlo');
    assert.equal(c.detalle[1].tipo, 'servicio');
    assert.match(c.detalle[1].solicitudServicio, /^SOL-/);
    assert.equal(c.detalle[1].estadoEvidencia, 'Pendiente de revisión');
    t.cotizacionLuis = c.numero;

    // Las 2 llantas salieron del inventario
    assert.equal(await stockDe(1), t.stockAntes - 2);

    // Al ser a crédito, quedó su solicitud pendiente por lo que se financia
    const solicitudes = await e.api(`/solicitudes-credito?q=${c.numero}`, { token: t.admin });
    const solicitud = solicitudes.cuerpo.datos[0];
    assert.equal(solicitud.estado, 'Pendiente');
    assert.equal(solicitud.cotizacion, c.numero);
    assert.equal(solicitud.monto, 576800 - 500000);
    t.solicitudLuis = solicitud.numero;
  });

  test('con un crédito abierto no se puede pedir otra cotización a crédito', async () => {
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.maria,
      cuerpo: { ...cotizacionCredito({ monto: 500000, medioPago: 'Efectivo' }), direccionEntrega: 'Calle 50' },
    });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /solo se permite uno/);
  });

  test('el cliente no puede cambiar el estado de su cotización', async () => {
    const r = await e.api(`/cotizaciones/${t.cotizacionLuis}`, {
      metodo: 'PATCH',
      token: t.luis,
      cuerpo: { estado: 'Aprobada' },
    });
    assert.equal(r.estado, 403);
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

  test('si no se aprueba, la cotización se rechaza y las llantas vuelven al stock', async () => {
    // Un cliente activo sin crédito abierto ni solicitudes pendientes
    const { rows } = await e.db.query(`
      SELECT c.id FROM cliente c
       WHERE c.activo AND c.correo <> 'lfmora@yahoo.com'
         AND NOT EXISTS (SELECT 1 FROM credito cr WHERE cr.cliente_id = c.id AND cr.saldo_pendiente > 0)
         AND NOT EXISTS (SELECT 1 FROM solicitud_credito s WHERE s.cliente_id = c.id AND s.estado = 'Pendiente')
       ORDER BY c.id LIMIT 1`);
    const cliente = rows[0].id;
    const antes = await stockDe(2);
    const r = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        clienteId: cliente,
        metodoPago: 'Crédito',
        plazoDias: 30,
        direccionEntrega: 'Cra 30 #25-90, Bogotá',
        lineas: [{ tipo: 'producto', productoId: 2, cantidad: 1 }],
        cuotaInicial: { monto: 400000, medioPago: 'Efectivo' },
      },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(await stockDe(2), antes - 1);

    const solicitud = (await e.api(`/solicitudes-credito?q=${r.cuerpo.datos.numero}`, { token: t.admin })).cuerpo.datos[0];
    const sinMotivo = await e.api(`/solicitudes-credito/${solicitud.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Rechazada' },
    });
    assert.equal(sinMotivo.estado, 422, 'no aprobar exige el motivo');

    const rechazo = await e.api(`/solicitudes-credito/${solicitud.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Rechazada', motivo: 'Sin respaldo' },
    });
    assert.equal(rechazo.estado, 200);
    const cotizacion = await e.api(`/cotizaciones/${r.cuerpo.datos.numero}`, { token: t.admin });
    assert.equal(cotizacion.cuerpo.datos.estado, 'Rechazada');
    assert.equal(await stockDe(2), antes, 'la llanta volvió al inventario');
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

    // Al anularla, la entrega se cancela y el stock no cambia
    const antes = await stockDe(1);
    const anulada = await e.api(`/compras/${r.cuerpo.datos.numero}`, {
      metodo: 'PATCH',
      token: t.admin,
      cuerpo: { estado: 'Anulada' },
    });
    assert.equal(anulada.cuerpo.datos.estadoEntrega, 'Cancelado');
    assert.equal(await stockDe(1), antes);
  });

  test('recibida y entregada, la compra sube el stock una sola vez', async () => {
    const r = await e.api('/compras', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { proveedorId: 1, lineas: [{ productoId: 3, cantidad: 5, precioUnitario: 200000, origen: 'Adicional' }] },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const numero = r.cuerpo.datos.numero;
    const antes = await stockDe(3);
    const cambiar = (cuerpo) => e.api(`/compras/${numero}`, { metodo: 'PATCH', token: t.admin, cuerpo });

    await cambiar({ estado: 'Recibida' });
    assert.equal(await stockDe(3), antes, 'falta que se entregue');
    await cambiar({ estadoEntrega: 'En camino' });
    await cambiar({ estadoEntrega: 'Entregado' });
    assert.equal(await stockDe(3), antes + 5);

    // Volver a enviar el mismo estado no la suma otra vez
    await cambiar({ estado: 'Recibida', estadoEntrega: 'Entregado' });
    assert.equal(await stockDe(3), antes + 5);
    const { rows } = await e.db.query('SELECT precio_compra FROM producto WHERE id = 3');
    assert.equal(Number(rows[0].precio_compra), 200000, 'guarda el último precio de compra');
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
