import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { aceptar } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de la llanta reencauchada que el cliente no pagó: queda "No
 * pagada" (la marca el asesor o pasa sola a los 30 días) y entra al catálogo
 * como "Llanta reencauchada": sin marca, categoría "Reencauchadas", una sola
 * unidad, precio fijo y sin compra al proveedor.
 */

let e;
const t = {};
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

const post = (ruta, cuerpo, token = t.admin) => e.api(ruta, { metodo: 'POST', token, cuerpo });

/** Una llanta reencauchada "Lista para entregar" → la orden. */
async function llantaLista() {
  const r = await post('/portal/reencauches', { bandaId: t.banda.id, medida: '295/80R22.5', cantidad: 1, lugar: 'Local', fechaPreferida: hoy() }, t.luis);
  const numero = r.cuerpo.datos.numero;
  await post(`/reencauches/${numero}/agenda`, { fechaRevision: hoy() });
  await post(`/reencauches/${numero}/revision`, {
    llantas: [{ medida: '295/80R22.5', resultado: 'Apta', bandaId: t.banda.id, manoObra: 220000 }],
  });
  await post(`/portal/reencauches/${numero}/respuesta`, { acepta: true }, t.luis);
  const orden = (await e.api(`/reencauches/ordenes?q=${numero}`, { token: t.admin })).cuerpo.datos[0];
  await post(`/reencauches/ordenes/${orden.id}/envio`, { terceroId: t.planta });
  await post(`/reencauches/ordenes/${orden.id}/lista`);
  return { ...orden, numero };
}

/** El producto (con los datos del personal) de una llanta reencauchada. */
const productoDe = async (identificador) =>
  (await e.api(`/productos?q=${encodeURIComponent('Llanta reencauchada')}&porPagina=100`, { token: t.admin })).cuerpo.datos.find(
    (p) => p.llantaReencauche === identificador,
  );

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');
  const tipos = (await e.api('/tipos-vehiculo', { token: t.admin })).cuerpo.datos;
  t.camion = tipos.find((v) => v.nombre === 'Camión / Tracto').id;
  t.planta = (await e.api('/terceros?activo=true', { token: t.admin })).cuerpo.datos[0].id;
  t.banda = (
    await post('/bandas', { nombre: 'Banda mixta 230', diseno: 'Mixta', tipoVehiculoId: t.camion, anchoMm: 230, profundidadMm: 17, medidas: ['295/80R22.5'], precio: 450000 })
  ).cuerpo.datos;
});

after(async () => {
  await e?.cerrar();
});

describe('El asesor la marca "No pagada"', () => {
  test('pide el precio de venta y solo aplica a una llanta lista para entregar', async () => {
    t.orden = await llantaLista();
    assert.match(t.orden.identificador, /^REE-\d{4}-\d{3}-1$/, 'el ID lo asigna el sistema');
    assert.equal((await post(`/reencauches/ordenes/${t.orden.id}/no-pagada`, {})).estado, 422);

    const r = await post(`/reencauches/ordenes/${t.orden.id}/no-pagada`, { precioVenta: 600000, motivo: 'El cliente no volvió' });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, 'No pagada');
    assert.ok(r.cuerpo.datos.productoCodigo, 'queda ligada a su producto');

    // Ya no se cobra ni se entrega
    assert.equal((await post(`/reencauches/ordenes/${t.orden.id}/entrega`, { medioPago: 'Efectivo' })).estado, 422);
    const s = (await e.api(`/reencauches/${t.orden.numero}`, { token: t.admin })).cuerpo.datos;
    assert.equal(s.valor, 0, 'lo que no se pagó no cuenta en el valor');
    assert.equal(s.noPagadas, 1);
  });

  test('entra al catálogo como "Llanta reencauchada", sin marca y en "Reencauchadas"', async () => {
    const p = await productoDe(t.orden.identificador);
    assert.equal(p.nombre, 'Llanta reencauchada');
    assert.equal(p.marca, 'Sin marca');
    assert.equal(p.categoria, 'Reencauchadas');
    assert.equal(p.foto, null);
    assert.equal(p.reencauchada, true);
    assert.equal(p.precioVenta, 600000);
    assert.equal(p.activo, true);
    t.producto = p;

    const portal = (await e.api('/productos?porPagina=100', { token: t.maria })).cuerpo.datos;
    assert.ok(portal.some((x) => x.id === p.id), 'el cliente la ve en el catálogo');
  });
});

describe('Un cliente la pide', () => {
  test('solo se pide una unidad', async () => {
    const r = await post('/cotizaciones', { direccionEntrega: 'Cra 5 #10-22', lineas: [{ tipo: 'producto', productoId: t.producto.id, cantidad: 2 }] }, t.maria);
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /una sola unidad/);
  });

  test('con precio fijo la cotización sale emitida, y la llanta queda apartada', async () => {
    const r = await post('/cotizaciones', { direccionEntrega: 'Cra 5 #10-22', lineas: [{ tipo: 'producto', productoId: t.producto.id, cantidad: 1 }] }, t.maria);
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    t.cotizacion = r.cuerpo.datos.numero;
    const c = (await e.api(`/cotizaciones/${t.cotizacion}`, { token: t.admin })).cuerpo.datos;
    assert.equal(c.etapa, 'Emitida');
    assert.equal(c.total, 600000);

    // Otro cliente ya no la ve ni la puede pedir
    const portal = (await e.api('/productos?porPagina=100', { token: t.luis })).cuerpo.datos;
    assert.ok(!portal.some((x) => x.id === t.producto.id));
    const otro = await post('/cotizaciones', { direccionEntrega: 'Cl 1', lineas: [{ tipo: 'producto', productoId: t.producto.id, cantidad: 1 }] }, t.luis);
    assert.equal(otro.estado, 422);
    assert.match(otro.cuerpo.error, /ya no está disponible/);
  });

  test('al pagarla no se genera compra al proveedor (ya es del negocio)', async () => {
    const aceptada = await aceptar(e, t.maria, t.cotizacion, { metodoPago: 'Contado', pago: { medioPago: 'Efectivo' } });
    assert.equal(aceptada.estado, 200, JSON.stringify(aceptada.cuerpo));
    assert.equal((await post(`/cotizaciones/${t.cotizacion}/pago`, { estado: 'Aprobado' })).estado, 200);
    const { rows } = await e.db.query(
      'SELECT COUNT(*)::int AS n FROM compra WHERE cotizacion_id = (SELECT id FROM cotizacion WHERE numero = $1)',
      [t.cotizacion],
    );
    assert.equal(rows[0].n, 0);
  });
});

describe('Pasa sola a los 30 días sin pago', () => {
  test('entra inactiva y sin precio, con aviso al personal', async () => {
    const orden = await llantaLista();
    await e.db.query("UPDATE reencauche_llanta SET lista_en = CURRENT_DATE - 31 WHERE id = $1", [orden.id]);
    const ordenes = (await e.api(`/reencauches/ordenes?q=${orden.numero}`, { token: t.admin })).cuerpo.datos;
    assert.equal(ordenes[0].estado, 'No pagada');

    const p = await productoDe(orden.identificador);
    assert.equal(p.activo, false, 'sin precio no se ofrece');
    t.automatica = p;
    const avisos = (await e.api('/notificaciones', { token: t.admin })).cuerpo.datos.notificaciones;
    assert.ok(avisos.some((n) => n.titulo.includes(orden.identificador)));
  });

  test('el administrador le pone precio (y el resto de datos) y la activa', async () => {
    const sinPrecio = await e.api(`/productos/${t.automatica.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: true } });
    assert.equal(sinPrecio.estado, 422);
    const r = await e.api(`/productos/${t.automatica.id}`, {
      metodo: 'PUT',
      token: t.admin,
      cuerpo: { precioVenta: 550000, activo: true, descripcion: 'Banda mixta, carcasa en buen estado' },
    });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.precioVenta, 550000);
    assert.equal(r.cuerpo.datos.activo, true);
  });

  test('un producto normal no recibe precio fijo', async () => {
    const r = await e.api('/productos/1', { metodo: 'PUT', token: t.admin, cuerpo: { precioVenta: 100000 } });
    assert.equal(r.estado, 422);
  });
});
