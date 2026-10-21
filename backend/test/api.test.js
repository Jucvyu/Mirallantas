import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { sembrar } from './fixtures/sembrar.js';
import { levantarEntorno } from './entorno.js';

let e;
const tokens = {};

before(async () => {
  e = await levantarEntorno();
  tokens.admin = await e.iniciarSesion('admin@mirallantas.com');
  tokens.secretaria = await e.iniciarSesion('pedro.m@mirallantas.com');
  tokens.maria = await e.iniciarSesion('maria@gmail.com');
});

after(async () => {
  await e?.cerrar();
});

describe('Salud y autenticación', () => {
  test('la API y la base responden', async () => {
    const r = await e.api('/salud');
    assert.equal(r.estado, 200);
    assert.deepEqual(r.cuerpo, { estado: 'ok' });
  });

  test('una contraseña incorrecta se rechaza sin revelar si el correo existe', async () => {
    const malaClave = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'admin@mirallantas.com', password: 'no-es-la-clave' },
    });
    const sinCuenta = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'nadie@ejemplo.com', password: 'no-es-la-clave' },
    });
    assert.equal(malaClave.estado, 401);
    assert.equal(sinCuenta.estado, 401);
    assert.equal(malaClave.cuerpo.error, sinCuenta.cuerpo.error);
  });

  test('un usuario inactivo no puede iniciar sesión y se le dice por qué', async () => {
    const r = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'luis.v@mirallantas.com', password: e.passwordDemo },
    });
    assert.equal(r.estado, 403);
    assert.equal(r.cuerpo.codigo, 'CUENTA_INACTIVA');
    assert.equal(r.cuerpo.token, undefined);
  });

  test('con la contraseña equivocada, una cuenta inactiva no revela su estado', async () => {
    const r = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'luis.v@mirallantas.com', password: 'NoEsLaClave99' },
    });
    assert.equal(r.estado, 401);
    assert.equal(r.cuerpo.codigo, undefined);
  });

  test('/auth/yo devuelve el usuario con sus permisos y sin el hash', async () => {
    const r = await e.api('/auth/yo', { token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.usuario.rol, 'Administrador');
    assert.ok(r.cuerpo.usuario.permisos.includes('Usuarios'));
    assert.ok(!r.cuerpo.usuario.permisos.includes('Empresa'), 'el módulo Empresa se retiró');
    assert.equal(r.cuerpo.usuario.password_hash, undefined);
  });

  test('sin token no se accede a los datos', async () => {
    const r = await e.api('/clientes');
    assert.equal(r.estado, 401);
  });

  test('un token alterado se rechaza', async () => {
    const r = await e.api('/clientes', { token: `${tokens.admin}x` });
    assert.equal(r.estado, 401);
  });

  test('un rol sin el permiso recibe 403', async () => {
    // Secretaría no tiene "Compras" ni "Productos"
    assert.equal((await e.api('/compras', { token: tokens.secretaria })).estado, 403);
    const r = await e.api('/productos/1', { metodo: 'PUT', token: tokens.secretaria, cuerpo: { nombre: 'Cambio' } });
    assert.equal(r.estado, 403);
  });
});

describe('Catálogos', () => {
  test('crea, valida y protege las categorías', async () => {
    const creada = await e.api('/categorias', {
      metodo: 'POST',
      token: tokens.admin,
      cuerpo: { nombre: 'Agrícola especial', color: '#123ABC' },
    });
    assert.equal(creada.estado, 201);
    assert.equal(creada.cuerpo.datos.activo, true);

    const repetida = await e.api('/categorias', { metodo: 'POST', token: tokens.admin, cuerpo: { nombre: 'Agrícola especial' } });
    assert.equal(repetida.estado, 409);

    const colorMalo = await e.api('/categorias', { metodo: 'POST', token: tokens.admin, cuerpo: { nombre: 'X', color: 'rojo' } });
    assert.equal(colorMalo.estado, 422);
    assert.equal(colorMalo.cuerpo.detalles[0].campo, 'color');

    const borrada = await e.api(`/categorias/${creada.cuerpo.datos.id}`, { metodo: 'DELETE', token: tokens.admin });
    assert.equal(borrada.estado, 204);
  });

  test('no se puede eliminar una categoría que usan productos', async () => {
    const lista = await e.api('/categorias?q=Turismo', { token: tokens.admin });
    const turismo = lista.cuerpo.datos.find((c) => c.nombre === 'Turismo');
    const r = await e.api(`/categorias/${turismo.id}`, { metodo: 'DELETE', token: tokens.admin });
    assert.equal(r.estado, 409);
  });

  test('los listados paginan y buscan', async () => {
    const r = await e.api('/clientes?porPagina=3&pagina=1', { token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.length, 3);
    assert.equal(r.cuerpo.total, 8);

    const busqueda = await e.api('/clientes?q=1024567890', { token: tokens.admin });
    assert.equal(busqueda.cuerpo.total, 1);
    assert.equal(busqueda.cuerpo.datos[0].nombreCompleto, 'María García Ruiz');
  });

  test('un documento de cliente repetido se rechaza', async () => {
    const r = await e.api('/clientes', {
      metodo: 'POST',
      token: tokens.admin,
      cuerpo: { tipoDocumento: 'CC', numeroDocumento: '1024567890', nombreCompleto: 'Otra persona' },
    });
    assert.equal(r.estado, 409);
  });
});

describe('Productos', () => {
  const nuevo = (extra = {}) => ({
    nombre: 'Llanta Prueba Código',
    categoriaId: 1,
    marcaId: 1,
    medidas: ' 205/55 r16 ',
    ...extra,
  });

  test('el servidor genera el código y no acepta uno escrito, ni precio de compra ni stock', async () => {
    for (const extra of [{ codigo: 'MIO-1' }, { precioCompra: 1 }, { precioVenta: 1 }, { stock: 5 }]) {
      const r = await e.api('/productos', { metodo: 'POST', token: tokens.admin, cuerpo: nuevo(extra) });
      assert.equal(r.estado, 422, JSON.stringify(extra));
    }
    const [a, b] = await Promise.all([
      e.api('/productos', { metodo: 'POST', token: tokens.admin, cuerpo: nuevo() }),
      e.api('/productos', { metodo: 'POST', token: tokens.admin, cuerpo: nuevo({ nombre: 'Otra Llanta' }) }),
    ]);
    assert.equal(a.estado, 201, JSON.stringify(a.cuerpo));
    assert.equal(b.estado, 201);
    assert.match(a.cuerpo.datos.codigo, /^ML-\d{6}$/);
    assert.notEqual(a.cuerpo.datos.codigo, b.cuerpo.datos.codigo, 'dos productos creados a la vez no repiten código');
    assert.equal(a.cuerpo.datos.medidas, '205/55R16', 'la medida se guarda normalizada');
    assert.ok(!('stock' in a.cuerpo.datos));

    // El código no cambia al editar
    const editado = await e.api(`/productos/${a.cuerpo.datos.id}`, { metodo: 'PUT', token: tokens.admin, cuerpo: { nombre: 'Nombre nuevo' } });
    assert.equal(editado.cuerpo.datos.codigo, a.cuerpo.datos.codigo);
  });

  test('el código, el precio de compra y el stock no se editan desde el producto', async () => {
    for (const cuerpo of [{ codigo: 'OTRO-1' }, { precioCompra: 1 }, { stock: 99 }]) {
      const r = await e.api('/productos/1', { metodo: 'PUT', token: tokens.admin, cuerpo });
      assert.equal(r.estado, 422, JSON.stringify(cuerpo));
    }
  });

  test('las medidas se listan sin repetir', async () => {
    const r = await e.api('/productos/medidas', { token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.datos.includes('295/80R22.5'));
    assert.equal(new Set(r.cuerpo.datos).size, r.cuerpo.datos.length);
  });

  test('el catálogo y la gestión de productos no devuelven precios', async () => {
    const r = await e.api('/productos/1', { metodo: 'PUT', token: tokens.admin, cuerpo: { precioVenta: 285000 } });
    assert.equal(r.estado, 422, 'el precio no se edita desde el producto');
    const admin = await e.api('/productos?porPagina=100', { token: tokens.admin });
    const sinPrecios = (p) => !['precioVenta', 'precioCompra', 'precioMinimo', 'precioMaximo', 'stock'].some((c) => c in p);
    assert.ok(admin.cuerpo.datos.every(sinPrecios));
    assert.ok(sinPrecios((await e.api('/productos/1', { token: tokens.admin })).cuerpo.datos));
  });

  test('el catálogo público no pide sesión y solo envía datos públicos de productos activos', async () => {
    const r = await e.api('/catalogo?porPagina=100');
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.datos.length > 0);
    const permitidos = ['id', 'codigo', 'nombre', 'descripcion', 'medidas', 'categoria', 'colorCategoria', 'marca', 'tipoVehiculo', 'foto'];
    assert.ok(r.cuerpo.datos.every((p) => Object.keys(p).every((c) => permitidos.includes(c))));
    const { rows } = await e.db.query('SELECT COUNT(*)::int AS n FROM producto WHERE activo');
    assert.equal(r.cuerpo.total, rows[0].n, 'solo los activos');
  });

  test('el portal solo ve productos activos, sin precios, costos ni stock', async () => {
    const r = await e.api('/productos?porPagina=100&activo=false', { token: tokens.maria });
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.datos.every((p) => p.activo && !('precioCompra' in p) && !('precioVenta' in p) && !('precioMinimo' in p)));
  });

  test('filtra por marca y busca por medida', async () => {
    const r = await e.api('/productos?q=295/80', { token: tokens.admin });
    assert.equal(r.cuerpo.total, 1);
    assert.equal(r.cuerpo.datos[0].codigo, 'GY-29580R225');
  });
});

describe('Documentos y alcance del portal', () => {
  test('el personal ve todas las cotizaciones', async () => {
    const r = await e.api('/cotizaciones?porPagina=100', { token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.total > 10);
  });

  test('el cliente solo ve sus propias cotizaciones, sin datos del proveedor', async () => {
    const r = await e.api('/cotizaciones?porPagina=100', { token: tokens.maria });
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.total > 0);
    assert.ok(r.cuerpo.datos.every((c) => c.cliente === 'María García Ruiz'));
    assert.ok(r.cuerpo.datos.every((c) => !('proveedor' in c)));
  });

  test('el cliente no puede abrir la cotización de otro (404, no 403)', async () => {
    const ajena = await e.api('/cotizaciones/PED-2024-001', { token: tokens.maria });
    assert.equal(ajena.estado, 404);

    const propia = await e.api('/cotizaciones/PED-2024-002', { token: tokens.maria });
    assert.equal(propia.estado, 200);
    assert.equal(propia.cuerpo.datos.detalle.length, 2);
    assert.deepEqual(
      propia.cuerpo.datos.detalle.map((l) => l.tipo),
      ['producto', 'servicio'],
    );
  });

  test('el detalle de un crédito trae sus abonos', async () => {
    const r = await e.api('/creditos/CRE-002', { token: tokens.maria });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.saldoPendiente, 575000);
    assert.ok(r.cuerpo.datos.abonos.length >= 3);
  });

  test('una venta conserva su detalle y su cotización de origen', async () => {
    const r = await e.api('/ventas/VEN-2024-002', { token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos.cotizacion, 'PED-2024-003');
    assert.equal(r.cuerpo.datos.detalle.length, 2);
  });
});

describe('Empresa', () => {
  test('nace sin datos: nada se precarga', async () => {
    const r = await e.api('/empresa', { token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.datos, null);
  });

  test('ya no se puede editar desde la API', async () => {
    const r = await e.api('/empresa', { metodo: 'PUT', token: tokens.admin, cuerpo: { nombre: 'X' } });
    assert.equal(r.estado, 404);
  });
});

describe('Reglas del esquema (directo en la base)', () => {
  test('un código de producto duplicado se rechaza', async () => {
    await assert.rejects(
      e.db.query(`INSERT INTO producto (codigo, nombre, categoria_id, marca_id, medidas, precio_venta)
                  VALUES ('ML-19565R15', 'Duplicado', 1, 1, '195/65R15', 1)`),
      { code: '23505', constraint: 'producto_codigo_key' },
    );
  });

  test('un cliente no puede tener dos créditos abiertos', async () => {
    const { rows } = await e.db.query(`SELECT id FROM cliente WHERE nombre_completo = 'María García Ruiz'`);
    await assert.rejects(
      e.db.query(
        `INSERT INTO credito (numero, cliente_id, monto_total, saldo_pendiente, plazo_dias, fecha_limite)
         VALUES ('CRE-PRUEBA', $1, 100000, 100000, 30, CURRENT_DATE + 30)`,
        [rows[0].id],
      ),
      { code: '23505', constraint: 'credito_un_abierto_por_cliente' },
    );
  });

  test('una cotización a crédito exige plazo', async () => {
    await assert.rejects(
      e.db.query(`INSERT INTO cotizacion (numero, cliente_id, metodo_pago, plazo_dias) VALUES ('PED-X', 1, 'Crédito', 0)`),
      { code: '23514', constraint: 'cotizacion_plazo_coherente' },
    );
  });

  test('los montos no pueden ser negativos', async () => {
    await assert.rejects(e.db.query(`UPDATE producto SET precio_venta = -1 WHERE id = 1`), { code: '23514' });
  });

  test('la numeración no repite números aunque se pidan a la vez', async () => {
    // 20 conexiones independientes piden 40 números al mismo tiempo
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: e.databaseUrl, max: 20 });
    const concurrentes = await Promise.all(
      Array.from({ length: 40 }, () => pool.query("SELECT siguiente_numero('CON') AS n")),
    );
    await pool.end();

    const numeros = concurrentes.map((r) => r.rows[0].n);
    assert.equal(new Set(numeros).size, 40, 'hay números repetidos');
    const anio = new Date().getFullYear();
    assert.ok(numeros.includes(`CON-${anio}-001`) && numeros.includes(`CON-${anio}-040`));
  });

  test('la numeración continúa después de los datos cargados', async () => {
    const { rows } = await e.db.query(`SELECT ultimo FROM consecutivo WHERE prefijo = 'PED' AND anio = 2024`);
    assert.equal(rows[0].ultimo, 68); // PED-2024-068 es el último cargado
  });

  test('el seed se niega a correr sobre una base con datos', async () => {
    await assert.rejects(sembrar(e.databaseUrl, { password: 'clave-de-prueba' }), /ya tiene datos/);
  });
});
