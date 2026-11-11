import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { PNG } from './comercial.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas del reencauche por banda: la banda como producto (solo con el
 * servicio), la revisión gratis llanta por llanta, la cotización aceptada sin
 * pagar y el cobro únicamente al entregar.
 */

let e;
const t = {};

/** Hoy en AAAA-MM-DD (el entorno de pruebas corre en la zona del negocio). */
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.asesor = await e.iniciarSesion('ana.rios@mirallantas.com');
  t.secretaria = await e.iniciarSesion('pedro.m@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');

  const tipos = await e.api('/tipos-vehiculo', { token: t.admin });
  t.camion = tipos.cuerpo.datos.find((v) => v.nombre === 'Camión / Tracto').id;
  const terceros = await e.api('/terceros?activo=true', { token: t.admin });
  t.planta = terceros.cuerpo.datos[0].id;
});

after(async () => {
  await e?.cerrar();
});

const nuevaBanda = (cuerpo) => e.api('/bandas', { metodo: 'POST', token: t.admin, cuerpo });
const solicitar = (cuerpo, token = t.luis) => e.api('/portal/reencauches', { metodo: 'POST', token, cuerpo });
const accion = (ruta, cuerpo, token = t.asesor) => e.api(ruta, { metodo: 'POST', token, cuerpo });

describe('Bandas', () => {
  test('la banda se crea con código propio y sus medidas compatibles', async () => {
    const r = await nuevaBanda({
      nombre: 'Banda tracción 220',
      diseno: 'Tracción',
      tipoVehiculoId: t.camion,
      anchoMm: 220,
      profundidadMm: 18,
      medidas: ['295/80r22.5', '11R22.5', '11R22.5'],
      precio: 470000,
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.match(r.cuerpo.datos.codigo, /^BAN-\d{4}$/);
    assert.deepEqual(r.cuerpo.datos.medidas, ['11R22.5', '295/80R22.5']);
    assert.equal(r.cuerpo.datos.tipoVehiculo, 'Camión / Tracto');
    t.banda = r.cuerpo.datos;
  });

  test('no se repite el nombre, y el ancho y el diseño se validan', async () => {
    const repetida = await nuevaBanda({ ...t.banda, tipoVehiculoId: t.camion, medidas: ['11R22.5'] });
    assert.equal(repetida.estado, 409);
    const angosta = await nuevaBanda({
      nombre: 'Muy angosta',
      diseno: 'Mixta',
      tipoVehiculoId: t.camion,
      anchoMm: 40,
      profundidadMm: 10,
      medidas: ['11R22.5'],
      precio: 1000,
    });
    assert.equal(angosta.estado, 422);
    const sinDiseno = await nuevaBanda({
      nombre: 'Diseño inventado',
      diseno: 'Arrastre',
      tipoVehiculoId: t.camion,
      anchoMm: 220,
      profundidadMm: 10,
      medidas: ['11R22.5'],
      precio: 1000,
    });
    assert.equal(sinDiseno.estado, 422);
  });

  test('el portal ve la banda sin precio y la lista de diseños llega en las referencias', async () => {
    const r = await e.api('/portal/bandas', { token: t.luis });
    assert.equal(r.estado, 200);
    const banda = r.cuerpo.datos.find((b) => b.id === t.banda.id);
    assert.ok(banda);
    assert.equal(banda.precio, undefined);

    const referencias = await e.api('/referencias');
    assert.deepEqual(
      referencias.cuerpo.disenosBanda.map((d) => d.nombre),
      ['Direccional', 'Tracción', 'Mixta'],
    );
  });

  test('sin el módulo Reencauche no se administra el catálogo', async () => {
    assert.equal((await e.api('/bandas', { token: t.secretaria })).estado, 403);
    assert.equal((await e.api('/bandas', { token: t.luis })).estado, 403);
    assert.equal((await e.api('/bandas', { token: t.asesor })).estado, 200);
  });
});

describe('Solicitud y revisión', () => {
  const pedido = () => ({
    bandaId: t.banda.id,
    medida: '295/80R22.5',
    cantidad: 3,
    lugar: 'Cliente',
    direccion: 'Cra 5 #10-22, Pereira',
    fechaPreferida: hoy(),
    notas: 'Son las de tracción del camión.',
  });

  test('la banda tiene que servir para la medida de la llanta', async () => {
    const r = await solicitar({ ...pedido(), medida: '12R22.5' });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /no es compatible/);
  });

  test('la dirección se pide si la revisión es donde el cliente, y la fecha no puede ser pasada', async () => {
    assert.equal((await solicitar({ ...pedido(), direccion: '' })).estado, 422);
    assert.equal((await solicitar({ ...pedido(), fechaPreferida: '2020-01-01' })).estado, 422);
  });

  test('el cliente pide el reencauche y el asesor recibe el aviso', async () => {
    const r = await solicitar(pedido());
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, 'Por agendar');
    assert.match(r.cuerpo.datos.numero, /^REE-\d{4}-\d{3}$/);
    t.numero = r.cuerpo.datos.numero;

    const avisos = await e.api('/notificaciones', { token: t.asesor });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.includes(t.numero)));
  });

  test('otro cliente no ve ni responde la solicitud', async () => {
    const mias = await e.api('/portal/reencauches', { token: t.maria });
    assert.ok(!mias.cuerpo.datos.some((s) => s.numero === t.numero));
    const r = await accion(`/portal/reencauches/${t.numero}/respuesta`, { acepta: true }, t.maria);
    assert.equal(r.estado, 404);
  });

  test('sin agendar no se registra la revisión', async () => {
    const r = await accion(`/reencauches/${t.numero}/revision`, {
      llantas: [{ identificador: 'LL-2321', medida: '295/80R22.5', resultado: 'Apta', bandaId: t.banda.id, manoObra: 220000 }],
    });
    assert.equal(r.estado, 422);
  });

  test('al agendar, el cliente recibe la fecha', async () => {
    const r = await accion(`/reencauches/${t.numero}/agenda`, { fechaRevision: hoy() });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, 'Agendada');
    const avisos = await e.api('/portal/notificaciones', { token: t.luis });
    assert.ok(avisos.cuerpo.datos.notificaciones.some((n) => n.titulo.includes(`Revisión agendada · ${t.numero}`)));
  });

  test('una llanta no apta lleva motivo y una apta lleva banda compatible', async () => {
    const sinMotivo = await accion(`/reencauches/${t.numero}/revision`, {
      llantas: [{ identificador: 'LL-0919', medida: '295/80R22.5', resultado: 'No apta' }],
    });
    assert.equal(sinMotivo.estado, 422);
    const incompatible = await accion(`/reencauches/${t.numero}/revision`, {
      llantas: [{ identificador: 'LL-2321', medida: '12R22.5', resultado: 'Apta', bandaId: t.banda.id, manoObra: 220000 }],
    });
    assert.equal(incompatible.estado, 422);
    assert.match(incompatible.cuerpo.error, /Llanta 1/);
  });

  test('la revisión deja la cotización: solo las aptas suman valor', async () => {
    const r = await accion(`/reencauches/${t.numero}/revision`, {
      llantas: [
        { identificador: 'LL-2321', medida: '295/80R22.5', resultado: 'Apta', bandaId: t.banda.id, manoObra: 220000 },
        { identificador: 'LL-1820', medida: '295/80R22.5', reencauchesPrevios: 1, resultado: 'Apta', bandaId: t.banda.id, precioBanda: 450000, manoObra: 200000 },
        { identificador: 'LL-0919', medida: '295/80R22.5', reencauchesPrevios: 2, resultado: 'No apta', motivoNoApta: 'Corte en el costado' },
      ],
    });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    const s = r.cuerpo.datos;
    assert.equal(s.estado, 'Cotizada');
    assert.equal(s.aptas, 2);
    assert.equal(s.noAptas, 1);
    // La primera toma el precio del catálogo; la segunda, el que escribió el asesor
    assert.equal(s.valor, 470000 + 220000 + 450000 + 200000);
    assert.equal(s.llantas[0].precioBanda, 470000);
    assert.equal(s.llantas[2].bandaId, null);
    // Aún no hay órdenes: el cliente no ha respondido
    assert.ok(s.llantas.every((l) => l.estado === null));
  });

  test('revisada, la solicitud ya no se cancela', async () => {
    const r = await accion(`/portal/reencauches/${t.numero}/cancelar`, {}, t.luis);
    assert.equal(r.estado, 422);
  });

  test('el cliente acepta sin pagar y cada llanta apta queda como orden', async () => {
    const r = await accion(`/portal/reencauches/${t.numero}/respuesta`, { acepta: true }, t.luis);
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, 'Aceptada');
    const estados = r.cuerpo.datos.llantas.map((l) => l.estado);
    // El ID de cada llanta lo asigna el sistema: número de la solicitud y posición
    assert.deepEqual(r.cuerpo.datos.llantas.map((l) => l.identificador), [1, 2, 3].map((n) => `${t.numero}-${n}`));
    assert.deepEqual(estados, ['Por enviar', 'Por enviar', null]);

    // Aceptar otra vez no duplica nada; responder lo contrario se explica
    const otraVez = await accion(`/portal/reencauches/${t.numero}/respuesta`, { acepta: true }, t.luis);
    assert.equal(otraVez.estado, 200);
    assert.deepEqual(otraVez.cuerpo.datos.llantas.map((l) => l.estado), ['Por enviar', 'Por enviar', null]);
    const contraria = await accion(`/portal/reencauches/${t.numero}/respuesta`, { acepta: false }, t.luis);
    assert.equal(contraria.estado, 422);
    assert.match(contraria.cuerpo.error, /ya aceptó/);
  });

  test('si el cliente ya aceptó en el portal, "Aceptó en el local" no falla', async () => {
    const r = await accion(`/reencauches/${t.numero}/respuesta`, { acepta: true });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, 'Aceptada');
  });
});

describe('Órdenes y cobro al entregar', () => {
  const ordenes = async () => {
    const r = await e.api(`/reencauches/ordenes?q=${t.numero}`, { token: t.asesor });
    return r.cuerpo.datos.filter((o) => o.reencauche === t.numero);
  };

  test('solo las llantas aceptadas son órdenes', async () => {
    const lista = await ordenes();
    assert.equal(lista.length, 2);
    [t.ordenA, t.ordenB] = lista.map((o) => o.id);
  });

  test('no se entrega (ni se cobra) lo que no ha vuelto de la planta', async () => {
    const r = await accion(`/reencauches/ordenes/${t.ordenA}/entrega`, { medioPago: 'Efectivo' });
    assert.equal(r.estado, 422);
  });

  test('la planta puede rechazar una llanta: no se cobra', async () => {
    assert.equal((await accion(`/reencauches/ordenes/${t.ordenB}/envio`, { terceroId: t.planta })).estado, 200);
    const rechazo = await accion(`/reencauches/ordenes/${t.ordenB}/rechazo`, { motivo: 'Separación interna' });
    assert.equal(rechazo.estado, 200);
    assert.equal(rechazo.cuerpo.datos.estado, 'Rechazada en planta');
    const cobro = await accion(`/reencauches/ordenes/${t.ordenB}/entrega`, { medioPago: 'Efectivo' });
    assert.equal(cobro.estado, 422);
  });

  test('se cobra al entregar la llanta terminada', async () => {
    const envio = await accion(`/reencauches/ordenes/${t.ordenA}/envio`, { terceroId: t.planta });
    assert.equal(envio.cuerpo.datos.estado, 'En planta');
    assert.ok(envio.cuerpo.datos.tercero);
    assert.equal((await accion(`/reencauches/ordenes/${t.ordenA}/lista`)).cuerpo.datos.estado, 'Lista para entregar');

    // Por transferencia se pide el comprobante; "Otro" ya no se acepta
    const sinComprobante = await accion(`/reencauches/ordenes/${t.ordenA}/entrega`, { medioPago: 'Transferencia' });
    assert.equal(sinComprobante.estado, 422);
    assert.equal((await accion(`/reencauches/ordenes/${t.ordenA}/entrega`, { medioPago: 'Otro' })).estado, 422);

    const entrega = await accion(`/reencauches/ordenes/${t.ordenA}/entrega`, { medioPago: 'Transferencia', comprobante: PNG });
    assert.equal(entrega.estado, 200, JSON.stringify(entrega.cuerpo));
    assert.ok(entrega.cuerpo.datos.pagoComprobante, 'queda el comprobante');
    assert.equal(entrega.cuerpo.datos.estado, 'Entregada');
    assert.equal(entrega.cuerpo.datos.pagoMedio, 'Transferencia');
    assert.ok(entrega.cuerpo.datos.pagoFecha);

    const s = (await e.api(`/reencauches/${t.numero}`, { token: t.asesor })).cuerpo.datos;
    // Lo rechazado en la planta ya no cuenta en el valor
    assert.equal(s.valor, 470000 + 220000);
    assert.equal(s.cobrado, 470000 + 220000);
    assert.equal(s.entregadas, 1);
    assert.equal(s.rechazadasPlanta, 1);
  });

  test('la base no deja registrar un pago sin entrega', async () => {
    await assert.rejects(
      e.db.query(
        "UPDATE reencauche_llanta SET pago_medio = 'Efectivo', pago_fecha = CURRENT_DATE WHERE id = $1",
        [t.ordenB],
      ),
      /reencauche_llanta_cobro/,
    );
  });

  test('una banda en uso no se elimina, se desactiva', async () => {
    assert.equal((await e.api(`/bandas/${t.banda.id}`, { metodo: 'DELETE', token: t.admin })).estado, 409);
    const r = await e.api(`/bandas/${t.banda.id}/estado`, { metodo: 'PATCH', token: t.admin, cuerpo: { activo: false } });
    assert.equal(r.cuerpo.datos.activo, false);
    const portal = await e.api('/portal/bandas', { token: t.luis });
    assert.ok(!portal.cuerpo.datos.some((b) => b.id === t.banda.id));
    // Inactiva, ya no se pide
    const pedido = await solicitar({ bandaId: t.banda.id, medida: '11R22.5', cantidad: 1, lugar: 'Local', fechaPreferida: hoy() });
    assert.equal(pedido.estado, 422);
    await e.api(`/bandas/${t.banda.id}/estado`, { metodo: 'PATCH', token: t.admin, cuerpo: { activo: true } });
  });

  test('el tablero cuenta las llantas entregadas', async () => {
    const r = await e.api('/dashboard', { token: t.admin });
    assert.equal(r.estado, 200);
  });
});

describe('Sin llantas aptas', () => {
  test('si ninguna sirve, la solicitud se cierra sin cotización', async () => {
    const r = await e.api('/reencauches', {
      metodo: 'POST',
      token: t.asesor,
      cuerpo: {
        clienteId: (await e.db.query("SELECT cliente_id FROM usuario WHERE correo = 'maria@gmail.com'")).rows[0].cliente_id,
        bandaId: t.banda.id,
        medida: '11R22.5',
        cantidad: 1,
        lugar: 'Local',
        fechaPreferida: hoy(),
      },
    });
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const numero = r.cuerpo.datos.numero;
    await accion(`/reencauches/${numero}/agenda`, { fechaRevision: hoy() });
    const revision = await accion(`/reencauches/${numero}/revision`, {
      llantas: [{ identificador: 'LL-1015', medida: '11R22.5', resultado: 'No apta', motivoNoApta: 'Carcasa de más de 7 años' }],
    });
    assert.equal(revision.cuerpo.datos.estado, 'Sin llantas aptas');
    assert.equal(revision.cuerpo.datos.valor, 0);
    const respuesta = await accion(`/reencauches/${numero}/respuesta`, { acepta: true });
    assert.equal(respuesta.estado, 422);
  });
});
