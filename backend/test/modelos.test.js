import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas del catálogo por modelos y referencias (migración 0040): cada
 * llanta es un modelo con su ficha técnica y sus medidas son referencias
 * (filas de `producto`, con su código ML-…). Las cotizaciones, ventas y
 * compras siguen apuntando a la referencia.
 */

let e;
const t = {};

const post = (ruta, cuerpo, token = t.admin) => e.api(ruta, { metodo: 'POST', token, cuerpo });
const put = (ruta, cuerpo, token = t.admin) => e.api(ruta, { metodo: 'PUT', token, cuerpo });
const patch = (ruta, cuerpo, token = t.admin) => e.api(ruta, { metodo: 'PATCH', token, cuerpo });

/** Un modelo nuevo con ficha técnica y dos medidas. */
const modeloNuevo = (extra = {}) => ({
  nombre: 'X Multi Z',
  descripcion: 'Llanta direccional para carga regional.',
  categoriaId: t.categoria,
  marcaId: t.marca,
  tipoVehiculoId: t.camion,
  uso: 'Regional',
  labrado: 'Rayado (5 canales)',
  construccion: 'Radial',
  sinCamara: true,
  garantiaMeses: 60,
  paisOrigen: 'Francia',
  recauchable: true,
  fuenteFicha: 'https://www.michelin.com.co/camion/x-multi-z',
  referencias: [
    { medidas: '295/80 r22.5', posicion: 'Direccional', indiceCarga: '152/148', lonas: 16, profundidadLabrado: 16.5, pesoKg: 64.2, codigoFabricante: 'MI-123456' },
    { medidas: '11R22.5', posicion: 'Direccional', indiceCarga: '148/145', lonas: 16 },
  ],
  ...extra,
});

before(async () => {
  e = await levantarEntorno();
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');
  t.secretaria = await e.iniciarSesion('pedro.m@mirallantas.com');
  const categorias = (await e.api('/categorias?porPagina=100', { token: t.admin })).cuerpo.datos;
  t.categoria = categorias.find((c) => c.nombre === 'Camión / Tracto').id;
  t.marca = (await e.api('/marcas?porPagina=100', { token: t.admin })).cuerpo.datos.find((m) => m.nombre === 'Michelin').id;
  t.camion = (await e.api('/tipos-vehiculo', { token: t.admin })).cuerpo.datos.find((v) => v.nombre === 'Camión / Tracto').id;
});

after(async () => {
  await e?.cerrar();
});

describe('Migración: los productos de siempre quedan con su modelo', () => {
  test('cada producto tiene modelo y no hay más modelos que productos', async () => {
    const { rows } = await e.db.query(
      `SELECT (SELECT count(*) FROM producto WHERE modelo_id IS NULL)::int AS sin_modelo,
              (SELECT count(*) FROM modelo_llanta)::int AS modelos,
              (SELECT count(*) FROM producto)::int AS productos`,
    );
    assert.equal(rows[0].sin_modelo, 0);
    assert.ok(rows[0].modelos <= rows[0].productos);
  });

  test('un INSERT de los de antes (sin modelo) busca o crea el modelo por marca + nombre', async () => {
    const { rows } = await e.db.query(
      `INSERT INTO producto (nombre, descripcion, categoria_id, marca_id, medidas, precio_venta)
       SELECT nombre, descripcion, categoria_id, marca_id, '205/60R16', 0 FROM producto WHERE id = 1
       RETURNING id, modelo_id`,
    );
    const original = (await e.db.query('SELECT modelo_id FROM producto WHERE id = 1')).rows[0];
    assert.equal(rows[0].modelo_id, original.modelo_id, 'se une al modelo existente');
    const r = await e.api('/productos/1', { token: t.admin });
    assert.ok(r.cuerpo.datos.modeloId);
  });

  test('la medida se separa en ancho, perfil y rin', async () => {
    const { rows } = await e.db.query(`SELECT ancho::float8, perfil::float8, rin::float8 FROM producto WHERE medidas = '295/80R22.5' LIMIT 1`);
    assert.deepEqual(rows[0], { ancho: 295, perfil: 80, rin: 22.5 });
  });
});

describe('Crear y listar modelos', () => {
  test('crea un modelo con ficha técnica y dos medidas', async () => {
    const r = await post('/modelos', modeloNuevo());
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    t.modelo = r.cuerpo.datos;
    assert.equal(t.modelo.nombre, 'X Multi Z');
    assert.equal(t.modelo.posiciones, 'Direccional');
    assert.equal(t.modelo.garantiaMeses, 60);
    assert.equal(t.modelo.referencias.length, 2);
    assert.ok(t.modelo.referencias.every((x) => /^ML-\d{6}$/.test(x.codigo)));
    const grande = t.modelo.referencias.find((x) => x.medidas === '295/80R22.5');
    assert.ok(grande, 'la medida se guarda sin espacios y en mayúsculas');
    assert.equal(grande.indiceCarga, '152/148');
    assert.equal(grande.posicion, 'Direccional');
    assert.equal(grande.profundidadLabrado, 16.5);
    assert.equal(grande.pesoKg, 64.2);
    assert.equal(grande.rin, 22.5);
    assert.ok(t.modelo.referencias.every((x) => !('precioVenta' in x)), 'sin precios');
  });

  test('lista los modelos con el conteo de medidas y busca por código del fabricante', async () => {
    const r = await e.api('/modelos?porPagina=100', { token: t.admin });
    assert.equal(r.estado, 200);
    const fila = r.cuerpo.datos.find((m) => m.id === t.modelo.id);
    assert.equal(fila.totalReferencias, 2);
    assert.equal(fila.referenciasActivas, 2);
    assert.equal(fila.marca, 'Michelin');
    const busqueda = await e.api('/modelos?q=MI-123456', { token: t.admin });
    assert.deepEqual(busqueda.cuerpo.datos.map((m) => m.id), [t.modelo.id]);
  });

  test('un modelo trae sus medidas y sus imágenes', async () => {
    const r = await e.api(`/modelos/${t.modelo.id}`, { token: t.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.referencias.length, 2);
    assert.deepEqual(r.cuerpo.datos.imagenes, []);
    assert.equal((await e.api('/modelos/999999', { token: t.admin })).estado, 404);
  });

  test('/api/productos conserva la forma plana: una fila por medida con los datos del modelo', async () => {
    const r = await e.api(`/productos?modeloId=${t.modelo.id}`, { token: t.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.total, 2);
    for (const p of r.cuerpo.datos) {
      assert.equal(p.nombre, 'X Multi Z');
      assert.equal(p.marca, 'Michelin');
      assert.equal(p.categoria, 'Camión / Tracto');
      assert.equal(p.tipoVehiculo, 'Camión / Tracto');
      assert.equal(p.modeloId, t.modelo.id);
      assert.equal(p.construccion, 'Radial');
      assert.ok('codigo' in p && 'medidas' in p && 'foto' in p && 'activo' in p);
    }
  });

  test('una medida repetida en el mismo modelo se rechaza con un mensaje claro', async () => {
    const r = await post(`/modelos/${t.modelo.id}/referencias`, { medidas: '295/80R22.5', posicion: 'Direccional', indiceCarga: '152/148' });
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.error, 'Esa medida ya está registrada para este producto.');
    // Y también dentro de la misma petición de alta
    const doble = await post('/modelos', modeloNuevo({ nombre: 'Otra', referencias: [{ medidas: '11R22.5' }, { medidas: '11r22.5' }] }));
    assert.equal(doble.estado, 422);
    assert.match(doble.cuerpo.error, /repetida/);
  });

  test('la misma marca no repite nombre (sin importar mayúsculas)', async () => {
    const r = await post('/modelos', modeloNuevo({ nombre: 'x multi z', referencias: [] }));
    assert.equal(r.estado, 409);
    assert.equal(r.cuerpo.error, 'Ya existe un producto con esa marca y nombre.');
  });

  test('valida la ficha y los datos de la medida', async () => {
    const r = await post('/modelos', modeloNuevo({ nombre: 'Mala', construccion: 'Mixta', garantiaMeses: 300, referencias: [{ medidas: '11R22.5', posicion: 'Delantera', indiceCarga: '1520' }] }));
    assert.equal(r.estado, 422);
    const campos = r.cuerpo.detalles.map((d) => d.campo);
    assert.ok(campos.includes('construccion'));
    assert.ok(campos.includes('referencias.0.posicion'));
    assert.ok(campos.includes('garantiaMeses'));
    assert.ok(campos.includes('referencias.0.indiceCarga'));
    // El índice de velocidad no existe en el catálogo
    const velocidad = await post(`/modelos/${t.modelo.id}/referencias`, { medidas: '12R22.5', indiceVelocidad: 'L' });
    assert.equal(velocidad.estado, 422);
  });

  test('exige categoría y marca activas', async () => {
    await patch(`/marcas/${t.marca}/estado`, { activo: false });
    const r = await post('/modelos', modeloNuevo({ nombre: 'Con marca inactiva', referencias: [] }));
    await patch(`/marcas/${t.marca}/estado`, { activo: true });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /marca está inactiva/);
  });

  test('escribir pide el permiso "Productos" y el portal no entra', async () => {
    assert.equal((await post('/modelos', modeloNuevo({ nombre: 'Sin permiso' }), t.secretaria)).estado, 403);
    assert.equal((await e.api('/modelos', { token: t.maria })).estado, 403);
  });
});

describe('Editar el modelo y sus medidas', () => {
  test('cambiar el modelo cambia todas sus medidas', async () => {
    const r = await put(`/modelos/${t.modelo.id}`, { nombre: 'X Multi Z2', labrado: 'Rayado' });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    const { rows } = await e.db.query('SELECT DISTINCT nombre FROM producto WHERE modelo_id = $1', [t.modelo.id]);
    assert.deepEqual(rows, [{ nombre: 'X Multi Z2' }]);
  });

  test('un PUT a /productos con campos del modelo actualiza el modelo (y a sus hermanas)', async () => {
    const [una, otra] = t.modelo.referencias;
    const r = await put(`/productos/${una.id}`, { descripcion: 'Direccional de larga duración en carretera.', lonas: 18 });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.lonas, 18);
    const hermana = (await e.api(`/productos/${otra.id}`, { token: t.admin })).cuerpo.datos;
    assert.equal(hermana.descripcion, 'Direccional de larga duración en carretera.');
    assert.equal(hermana.lonas, 16, 'las lonas son de cada medida');
  });

  test('la misma medida puede venir en otra posición (y no se repite en la misma)', async () => {
    const traccion = await post(`/modelos/${t.modelo.id}/referencias`, { medidas: '295/80R22.5', posicion: 'Tracción', indiceCarga: '152/148' });
    assert.equal(traccion.estado, 201, JSON.stringify(traccion.cuerpo));
    assert.equal(traccion.cuerpo.datos.posicion, 'Tracción');
    const otraVez = await post(`/modelos/${t.modelo.id}/referencias`, { medidas: '295/80R22.5', posicion: 'Tracción', indiceCarga: '152/148' });
    assert.equal(otraVez.estado, 409);
    const modelo = (await e.api(`/modelos/${t.modelo.id}`, { token: t.admin })).cuerpo.datos;
    assert.equal(modelo.posiciones, 'Direccional, Tracción');
    await patch(`/modelos/${t.modelo.id}/referencias/${traccion.cuerpo.datos.id}/estado`, { activo: false });
  });

  test('sube el PDF de la ficha técnica (solo PDF de verdad)', async () => {
    const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 %%EOF').toString('base64')}`;
    const r = await put(`/modelos/${t.modelo.id}`, { fichaPdf: pdf });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.fichaPdf, pdf, 'sin Cloudinary queda la misma data URL');
    const falso = `data:application/pdf;base64,${Buffer.from('<html>no soy pdf</html>').toString('base64')}`;
    const malo = await put(`/modelos/${t.modelo.id}`, { fichaPdf: falso });
    assert.equal(malo.estado, 422);
    assert.match(malo.cuerpo.detalles[0].mensaje, /no es un PDF/);
    assert.equal((await e.db.query('SELECT imagen_en_uso($1) AS uso', [pdf])).rows[0].uso, true);
  });

  test('agrega, edita y desactiva una medida', async () => {
    const nueva = await post(`/modelos/${t.modelo.id}/referencias`, { medidas: '315/80R22.5', indiceCarga: '156/150', codigoFabricante: 'MI-999' });
    assert.equal(nueva.estado, 201, JSON.stringify(nueva.cuerpo));
    t.referencia = nueva.cuerpo.datos;
    assert.equal(t.referencia.nombre, 'X Multi Z2');

    const editada = await put(`/modelos/${t.modelo.id}/referencias/${t.referencia.id}`, { pesoKg: 70, profundidadLabrado: '' });
    assert.equal(editada.estado, 200, JSON.stringify(editada.cuerpo));
    assert.equal(editada.cuerpo.datos.pesoKg, 70);
    assert.equal(editada.cuerpo.datos.profundidadLabrado, null);

    const inactiva = await patch(`/modelos/${t.modelo.id}/referencias/${t.referencia.id}/estado`, { activo: false });
    assert.equal(inactiva.estado, 200);
    assert.equal(inactiva.cuerpo.datos.activo, false);
    // Una medida de otro modelo no se toca desde aquí
    assert.equal((await patch(`/modelos/${t.modelo.id}/referencias/1/estado`, { activo: false })).estado, 404);
  });
});

describe('Catálogo público y cotizaciones', () => {
  test('el catálogo público trae la ficha, pero no el código del fabricante ni la fuente', async () => {
    const r = await e.api('/catalogo?porPagina=100');
    const fila = r.cuerpo.datos.find((p) => p.modeloId === t.modelo.id);
    assert.ok(fila);
    assert.equal(fila.construccion, 'Radial');
    assert.equal(fila.posicion, 'Direccional');
    assert.ok(!('codigoFabricante' in fila) && !('fuenteFicha' in fila));
    assert.ok(fila.fichaPdf, 'el cliente puede ver el PDF de la ficha');
    // El detalle del producto pide solo sus medidas
    const detalle = await e.api(`/catalogo?modeloId=${t.modelo.id}`);
    assert.ok(detalle.cuerpo.datos.length >= 2);
    assert.ok(detalle.cuerpo.datos.every((p) => p.modeloId === t.modelo.id));
  });

  test('una cotización con una referencia funciona como siempre', async () => {
    const [una] = t.modelo.referencias;
    const r = await post('/cotizaciones', { direccionEntrega: 'Calle 50 #45-12', lineas: [{ tipo: 'producto', productoId: una.id, cantidad: 2 }] }, t.maria);
    assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
    const c = (await e.api(`/cotizaciones/${r.cuerpo.datos.numero}`, { token: t.admin })).cuerpo.datos;
    assert.equal(c.detalle[0].productoId, una.id);
    assert.equal(c.detalle[0].descripcion, 'X Multi Z2');
    assert.equal(c.detalle[0].medida, una.medidas);
  });

  test('desactivar el modelo lo saca del catálogo y de las cotizaciones nuevas', async () => {
    const r = await patch(`/modelos/${t.modelo.id}/estado`, { activo: false });
    assert.equal(r.estado, 200);
    const publico = (await e.api('/catalogo?porPagina=100')).cuerpo.datos;
    assert.ok(!publico.some((p) => p.modeloId === t.modelo.id));
    const portal = (await e.api('/productos?porPagina=100', { token: t.maria })).cuerpo.datos;
    assert.ok(!portal.some((p) => p.modeloId === t.modelo.id));
    const [una] = t.modelo.referencias;
    const cot = await post('/cotizaciones', { direccionEntrega: 'Calle 50 #45-12', lineas: [{ tipo: 'producto', productoId: una.id, cantidad: 1 }] }, t.maria);
    assert.equal(cot.estado, 422);
    // Se vuelve a activar
    assert.equal((await patch(`/modelos/${t.modelo.id}/estado`, { activo: true })).estado, 200);
    assert.ok((await e.api('/catalogo?porPagina=100')).cuerpo.datos.some((p) => p.modeloId === t.modelo.id));
  });

  test('desactivar la categoría desactiva sus modelos', async () => {
    const cat = await post('/categorias', { nombre: 'Agrícola', descripcion: 'Llantas para tractor', color: '#22C55E' });
    assert.equal(cat.estado, 201, JSON.stringify(cat.cuerpo));
    const m = await post('/modelos', modeloNuevo({ nombre: 'Agro Bib', categoriaId: cat.cuerpo.datos.id, referencias: [{ medidas: '18.4-38' }] }));
    assert.equal(m.estado, 201, JSON.stringify(m.cuerpo));
    await patch(`/categorias/${cat.cuerpo.datos.id}/estado`, { activo: false });
    const { rows } = await e.db.query('SELECT activo FROM modelo_llanta WHERE id = $1', [m.cuerpo.datos.id]);
    assert.equal(rows[0].activo, false);
  });
});

describe('Fotos y llantas reencauchadas', () => {
  test('la foto del modelo sirve para sus medidas y la limpieza no la borra', async () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/modelo-prueba.jpg';
    await e.db.query('INSERT INTO modelo_imagen (modelo_id, url) VALUES ($1, $2)', [t.modelo.id, url]);
    const p = (await e.api(`/productos/${t.modelo.referencias[0].id}`, { token: t.admin })).cuerpo.datos;
    assert.equal(p.foto, url);
    assert.equal((await e.db.query('SELECT imagen_en_uso($1) AS uso', [url])).rows[0].uso, true);
    // Al quitarla se anota para limpiarla de Cloudinary
    await e.db.query('DELETE FROM modelo_imagen WHERE url = $1', [url]);
    assert.equal((await e.db.query('SELECT count(*)::int AS n FROM imagen_por_borrar WHERE url = $1', [url])).rows[0].n, 1);
  });

  test('la página de una reencauchada pide solo esa unidad (con su precio)', async () => {
    const { rows } = await e.db.query(
      `INSERT INTO producto (nombre, descripcion, categoria_id, marca_id, medidas, precio_venta, reencauchada)
       VALUES ('Llanta reencauchada', 'Reencauche banda C · ID REE-X-9',
               (SELECT id FROM categoria WHERE nombre = 'Reencauchadas'), (SELECT id FROM marca WHERE nombre = 'Sin marca'),
               '11R22.5', 480000, TRUE)
       RETURNING id`,
    );
    const r = await e.api(`/catalogo?id=${rows[0].id}`);
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.total, 1);
    assert.equal(r.cuerpo.datos[0].precioVenta, 480000);
    assert.equal(r.cuerpo.datos[0].reencauchada, true);
  });

  test('las reencauchadas no se agrupan: misma medida y descripción propia', async () => {
    const valores = async (descripcion) =>
      (
        await e.db.query(
          `INSERT INTO producto (nombre, descripcion, categoria_id, marca_id, medidas, precio_venta, reencauchada)
           VALUES ('Llanta reencauchada', $1,
                   (SELECT id FROM categoria WHERE nombre = 'Reencauchadas'), (SELECT id FROM marca WHERE nombre = 'Sin marca'),
                   '295/80R22.5', 500000, TRUE)
           RETURNING modelo_id, descripcion`,
          [descripcion],
        )
      ).rows[0];
    const a = await valores('Reencauche banda A · ID REE-X-1');
    const b = await valores('Reencauche banda B · ID REE-X-2');
    assert.equal(a.modelo_id, b.modelo_id);
    assert.equal(a.descripcion, 'Reencauche banda A · ID REE-X-1');
    assert.equal(b.descripcion, 'Reencauche banda B · ID REE-X-2');
    // Su modelo no recibe medidas a mano
    const r = await post(`/modelos/${a.modelo_id}/referencias`, { medidas: '11R22.5' });
    assert.equal(r.estado, 422);
  });
});
