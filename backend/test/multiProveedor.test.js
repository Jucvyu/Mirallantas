import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { aceptar, solicitud } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Una llanta de la cotización se reparte entre varios proveedores: cada uno
 * con su cantidad y su precio de compra, y un solo precio de venta. En la
 * orden de compra, cada proveedor es una línea.
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

const lineaProducto = async (numero) =>
  (await e.api(`/cotizaciones/${numero}`, { token: t.admin })).cuerpo.datos.detalle.find((l) => l.tipo === 'producto');

describe('Cotización con una llanta repartida entre varios proveedores', () => {
  let numero;
  let lineaId;

  test('se crea y se emite con el reparto (cantidades que suman la de la llanta)', async () => {
    const creada = await e.api('/cotizaciones', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: solicitud([{ tipo: 'producto', productoId: 1, cantidad: 3 }], { clienteId: 1 }),
    });
    assert.equal(creada.estado, 201, JSON.stringify(creada.cuerpo));
    numero = creada.cuerpo.datos.numero;
    lineaId = (await lineaProducto(numero)).id;

    // 3 llantas: 2 al proveedor 1 ($100.000) y 1 al proveedor 2 ($110.000); venta $150.000
    const emitir = (proveedores) =>
      e.api(`/cotizaciones/${numero}/emitir`, {
        metodo: 'POST',
        token: t.admin,
        cuerpo: { lineas: [{ id: lineaId, precioUnitario: 150000, proveedores }] },
      });

    const ok = await emitir([
      { proveedorId: 1, cantidad: 2, costo: 100000 },
      { proveedorId: 2, cantidad: 1, costo: 110000 },
    ]);
    assert.equal(ok.estado, 200, JSON.stringify(ok.cuerpo));

    // El detalle muestra el reparto por proveedor
    const linea = await lineaProducto(numero);
    assert.equal(linea.proveedoresLinea.length, 2);
    assert.equal(linea.proveedoresLinea.reduce((s, p) => s + p.cantidad, 0), 3);
    assert.ok(linea.proveedoresLinea.some((p) => p.proveedorId === 1 && p.cantidad === 2 && p.costo === 100000));
  });

  test('rechaza un reparto cuyas cantidades no suman la de la llanta', async () => {
    const mal = await e.api(`/cotizaciones/${numero}/emitir`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        lineas: [
          {
            id: lineaId,
            precioUnitario: 150000,
            proveedores: [
              { proveedorId: 1, cantidad: 1, costo: 100000 },
              { proveedorId: 2, cantidad: 1, costo: 110000 },
            ],
          },
        ],
      },
    });
    assert.equal(mal.estado, 422);
    assert.match(mal.cuerpo.error, /cantidades por proveedor/);
    // El reparto válido anterior se conserva
    assert.equal((await lineaProducto(numero)).proveedoresLinea.length, 2);
  });

  test('rechaza un precio de venta menor que algún precio de compra', async () => {
    const mal = await e.api(`/cotizaciones/${numero}/emitir`, {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        lineas: [
          {
            id: lineaId,
            precioUnitario: 105000,
            proveedores: [
              { proveedorId: 1, cantidad: 2, costo: 100000 },
              { proveedorId: 2, cantidad: 1, costo: 110000 },
            ],
          },
        ],
      },
    });
    assert.equal(mal.estado, 422);
    const mensajes = JSON.stringify(mal.cuerpo.detalles ?? mal.cuerpo.error);
    assert.match(mensajes, /no puede ser menor/);
  });

  test('al pagarla, la orden de compra tiene una línea por proveedor', async () => {
    await aceptar(e, t.admin, numero, { metodoPago: 'Contado', pago: { medioPago: 'Efectivo' } }, { desdePortal: false });
    const pago = await e.api(`/cotizaciones/${numero}/pago`, { metodo: 'POST', token: t.admin, cuerpo: { estado: 'Aprobado' } });
    assert.equal(pago.estado, 200, JSON.stringify(pago.cuerpo));

    const compras = await e.api('/compras?porPagina=100', { token: t.admin });
    const compra = compras.cuerpo.datos.find((c) => c.cotizacion === numero);
    assert.ok(compra, 'se generó la orden de compra');
    const detalle = (await e.api(`/compras/${compra.numero}`, { token: t.admin })).cuerpo.datos.detalle;
    const delProducto = detalle.filter((l) => l.productoId === 1);
    assert.equal(delProducto.length, 2, 'una línea por proveedor');
    assert.ok(delProducto.some((l) => l.proveedorId === 1 && l.cantidad === 2));
    assert.ok(delProducto.some((l) => l.proveedorId === 2 && l.cantidad === 1));
    // La compra no tiene un proveedor único en la cabecera (son varios)
    assert.ok(!compra.proveedor);
  });
});
