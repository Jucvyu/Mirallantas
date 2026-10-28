import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { migrarArriba } from '../../database/migrate.js';
import { eliminarGestion, esLocal } from '../../database/eliminarGestion.js';
import { limpiar } from '../../database/limpiar.js';
import { crearRespaldo, restaurarRespaldo } from '../../database/respaldo.js';
import { codigoActual } from '../src/utils/totp.js';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de seguridad: doble factor obligatorio para el Administrador,
 * sesiones, bloqueo por intentos, rol Administrador protegido, archivos,
 * pagos duplicados, bitácora y copias de seguridad.
 *
 * Este archivo corre en su propio proceso, así que puede exigir el doble
 * factor al Administrador sin afectar las demás pruebas.
 */
process.env.EXIGIR_2FA_ADMIN = 'true';

// Imagen PNG real de 1×1 píxel
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let e;
const t = {};

/** Inicia sesión y devuelve la respuesta completa. */
const login = (correo, password = e.passwordDemo) =>
  e.api('/auth/login', { metodo: 'POST', cuerpo: { correo, password } });

before(async () => {
  e = await levantarEntorno();
});

after(async () => {
  await e?.cerrar();
});

describe('Cabeceras y superficie expuesta', () => {
  test('la API responde con cabeceras de seguridad y sin delatar la tecnología', async () => {
    const r = await fetch(`${e.base}/salud`);
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('cache-control'), 'no-store');
  });

  test('una ruta inexistente responde 404 sin detalles internos', async () => {
    const r = await e.api('/admin/.env');
    assert.equal(r.estado, 404);
    assert.deepEqual(Object.keys(r.cuerpo), ['error']);
  });
});

describe('Doble factor obligatorio para el Administrador', () => {
  test('sin doble factor, el Administrador solo puede configurarlo', async () => {
    const r = await login('admin@mirallantas.com');
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.usuario.debeActivar2fa, true);
    t.adminSin2fa = r.cuerpo.token;

    const bloqueado = await e.api('/clientes', { token: t.adminSin2fa });
    assert.equal(bloqueado.estado, 403);
    assert.equal(bloqueado.cuerpo.codigo, '2FA_REQUERIDO');

    const yo = await e.api('/auth/yo', { token: t.adminSin2fa });
    assert.equal(yo.estado, 200);
  });

  test('lo activa con el código de su app y las sesiones anteriores se cierran', async () => {
    const config = await e.api('/auth/2fa/configurar', { metodo: 'POST', token: t.adminSin2fa });
    assert.equal(config.estado, 200);
    assert.match(config.cuerpo.direccion, /^otpauth:\/\/totp\//);
    t.secretoAdmin = config.cuerpo.secreto;

    // En la base el secreto queda cifrado, nunca en texto plano
    const { rows } = await e.db.query("SELECT totp_secreto FROM usuario WHERE correo = 'admin@mirallantas.com'");
    assert.ok(rows[0].totp_secreto.startsWith('v1.'));
    assert.ok(!rows[0].totp_secreto.includes(t.secretoAdmin));

    const malo = await e.api('/auth/2fa/activar', { metodo: 'POST', token: t.adminSin2fa, cuerpo: { codigo: '000000' } });
    assert.equal(malo.estado, 422);

    const ok = await e.api('/auth/2fa/activar', {
      metodo: 'POST',
      token: t.adminSin2fa,
      cuerpo: { codigo: codigoActual(t.secretoAdmin) },
    });
    assert.equal(ok.estado, 200);
    assert.equal(ok.cuerpo.usuario.dosFactores, true);
    t.admin = ok.cuerpo.token;

    assert.equal((await e.api('/auth/yo', { token: t.adminSin2fa })).estado, 401, 'el token viejo ya no sirve');
    assert.equal((await e.api('/clientes', { token: t.admin })).estado, 200);
  });

  test('al iniciar sesión pide el código y rechaza uno incorrecto', async () => {
    const paso1 = await login('admin@mirallantas.com');
    assert.equal(paso1.estado, 200);
    assert.equal(paso1.cuerpo.requiere2fa, true);
    assert.equal(paso1.cuerpo.token, undefined, 'la contraseña sola no entrega sesión');

    const malo = await e.api('/auth/2fa/verificar', {
      metodo: 'POST',
      cuerpo: { desafio: paso1.cuerpo.desafio, codigo: '123456' === codigoActual(t.secretoAdmin) ? '654321' : '123456' },
    });
    assert.equal(malo.estado, 401);

    // El desafío no sirve como token de sesión
    assert.equal((await e.api('/auth/yo', { token: paso1.cuerpo.desafio })).estado, 401);

    const bueno = await e.api('/auth/2fa/verificar', {
      metodo: 'POST',
      cuerpo: { desafio: paso1.cuerpo.desafio, codigo: codigoActual(t.secretoAdmin) },
    });
    assert.equal(bueno.estado, 200);
    assert.ok(bueno.cuerpo.token);
    t.admin = bueno.cuerpo.token;
  });

  test('el Administrador no puede desactivarlo', async () => {
    const r = await e.api('/auth/2fa/desactivar', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { passwordActual: e.passwordDemo, codigo: codigoActual(t.secretoAdmin) },
    });
    assert.equal(r.estado, 422);
  });
});

describe('Rol Administrador y panel de seguridad', () => {
  test('el rol Administrador no se edita ni se elimina', async () => {
    const roles = await e.api('/roles', { token: t.admin });
    const admin = roles.cuerpo.datos.find((r) => r.nombre === 'Administrador');
    t.rolAdmin = admin.id;

    const editar = await e.api(`/roles/${admin.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { descripcion: 'Otra' } });
    assert.equal(editar.estado, 422);
    const permisos = await e.api(`/roles/${admin.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { permisos: ['Clientes'] } });
    assert.equal(permisos.estado, 422);
    const borrar = await e.api(`/roles/${admin.id}`, { metodo: 'DELETE', token: t.admin });
    assert.equal(borrar.estado, 422);
  });

  test('la base de datos también protege el rol Administrador', async () => {
    await assert.rejects(e.db.query("UPDATE rol SET nombre = 'Jefe' WHERE nombre = 'Administrador'"), /no se puede editar/);
    await assert.rejects(
      e.db.query("DELETE FROM rol_permiso WHERE rol_id = (SELECT id FROM rol WHERE nombre = 'Administrador')"),
      /no se pueden quitar/,
    );
  });

  test('un rol con permiso de Usuarios y Roles no entra si no es Administrador', async () => {
    const rol = await e.api('/roles', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Supervisor', permisos: ['Usuarios', 'Roles', 'Clientes'] },
    });
    assert.equal(rol.estado, 201);
    const usuario = await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Sara Supervisora',
        tipoDocumento: 'CC',
        numeroDocumento: '11223344',
        correo: 'sara@mirallantas.com',
        rolId: rol.cuerpo.datos.id,
        password: 'ClaveSegura2026',
      },
    });
    assert.equal(usuario.estado, 201);

    const sara = (await login('sara@mirallantas.com', 'ClaveSegura2026')).cuerpo.token;
    // Podría darse el rol Administrador a sí misma: por eso se bloquea
    const intento = await e.api(`/usuarios/${usuario.cuerpo.datos.id}`, {
      metodo: 'PUT',
      token: sara,
      cuerpo: { rolId: t.rolAdmin },
    });
    assert.equal(intento.estado, 403);
    assert.equal((await e.api('/roles', { token: sara })).estado, 403);
    assert.equal((await e.api('/clientes', { token: sara })).estado, 200);
  });

  test('nivel 3: un rol que solo puede ver clientes no los crea ni los elimina', async () => {
    const rol = await e.api('/roles', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Consulta de clientes',
        permisos: ['Clientes'],
        denegadas: { Clientes: ['crear', 'eliminar'] },
      },
    });
    assert.equal(rol.estado, 201, JSON.stringify(rol.cuerpo));
    assert.deepEqual(rol.cuerpo.datos.denegadas.Clientes, ['crear', 'eliminar']);
    const usuario = await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Pablo Consulta',
        tipoDocumento: 'CC',
        numeroDocumento: '55667788',
        correo: 'pablo.consulta@mirallantas.com',
        rolId: rol.cuerpo.datos.id,
        password: 'ClaveSegura2026',
      },
    });
    assert.equal(usuario.estado, 201, JSON.stringify(usuario.cuerpo));
    const pablo = await e.iniciarSesion('pablo.consulta@mirallantas.com', 'ClaveSegura2026');

    const lista = await e.api('/clientes', { token: pablo });
    assert.equal(lista.estado, 200, 'ver sí');
    const crear = await e.api('/clientes', {
      metodo: 'POST',
      token: pablo,
      cuerpo: { nombreCompleto: 'Cliente Nuevo', tipoDocumento: 'CC', numeroDocumento: '99887766', telefono: '3001234567' },
    });
    assert.equal(crear.estado, 403, 'crear no');
    assert.match(crear.cuerpo.error, /crear/);
    const eliminar = await e.api(`/clientes/${lista.cuerpo.datos[0].id}`, { metodo: 'DELETE', token: pablo });
    assert.equal(eliminar.estado, 403, 'eliminar no');

    // La sesión trae los privilegios para que el panel oculte los botones
    const yo = await e.api('/auth/yo', { token: pablo });
    assert.deepEqual(yo.cuerpo.usuario.denegadas.Clientes, ['crear', 'eliminar']);
  });

  test('nivel 3: cada acción del módulo se niega por separado (anular, ver detalle…)', async () => {
    const rol = await e.api('/roles', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Vendedor sin anular', permisos: ['Ventas'], denegadas: { Ventas: ['anular', 'verDetalle'] } },
    });
    assert.equal(rol.estado, 201, JSON.stringify(rol.cuerpo));
    // Una acción que no existe en el módulo se rechaza
    const mala = await e.api('/roles', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Rol raro', permisos: ['Ventas'], denegadas: { Ventas: ['volar'] } },
    });
    assert.equal(mala.estado, 422);

    await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Vera Vendedora', tipoDocumento: 'CC', numeroDocumento: '77889900', correo: 'vera@mirallantas.com', rolId: rol.cuerpo.datos.id, password: 'ClaveSegura2026' },
    });
    const vera = await e.iniciarSesion('vera@mirallantas.com', 'ClaveSegura2026');
    const ventas = await e.api('/ventas', { token: vera });
    assert.equal(ventas.estado, 200, 'el listado sí');
    const una = ventas.cuerpo.datos[0].numero;
    assert.equal((await e.api(`/ventas/${una}`, { token: vera })).estado, 403, 'ver detalle no');
    const anular = await e.api(`/ventas/${una}`, { metodo: 'PATCH', token: vera, cuerpo: { estado: 'Anulada' } });
    assert.equal(anular.estado, 403);
    assert.match(anular.cuerpo.error, /anular/);
  });

  test('un rol desactivado no deja entrar a sus usuarios (y el Administrador no se desactiva)', async () => {
    const rol = await e.api('/roles', { metodo: 'POST', token: t.admin, cuerpo: { nombre: 'Temporal', permisos: ['Clientes'] } });
    await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: { nombre: 'Tomas Temporal', tipoDocumento: 'CC', numeroDocumento: '66778899', correo: 'tomas@mirallantas.com', rolId: rol.cuerpo.datos.id, password: 'ClaveSegura2026' },
    });
    const tomas = await e.iniciarSesion('tomas@mirallantas.com', 'ClaveSegura2026');
    const off = await e.api(`/roles/${rol.cuerpo.datos.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: false } });
    assert.equal(off.estado, 200, JSON.stringify(off.cuerpo));
    // Su sesión abierta deja de servir y no puede volver a entrar
    assert.notEqual((await e.api('/clientes', { token: tomas })).estado, 200);
    const login = await e.api('/auth/login', { metodo: 'POST', cuerpo: { correo: 'tomas@mirallantas.com', password: 'ClaveSegura2026' } });
    assert.notEqual(login.estado, 200);

    const roles = await e.api('/roles', { token: t.admin });
    const admin = roles.cuerpo.datos.find((r) => r.nombre === 'Administrador');
    assert.equal((await e.api(`/roles/${admin.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { activo: false } })).estado, 422);
  });

  test('el administrador principal no se edita desde Usuarios', async () => {
    const usuarios = await e.api('/usuarios?porPagina=100', { token: t.admin });
    const principal = usuarios.cuerpo.datos.find((u) => u.principal);
    assert.ok(principal, 'el listado marca al principal');
    const r = await e.api(`/usuarios/${principal.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { nombre: 'Otro Nombre' } });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo.error, /principal/);
  });

  test('el último Administrador no puede quitarse el rol', async () => {
    const yo = await e.api('/auth/yo', { token: t.admin });
    const roles = await e.api('/roles', { token: t.admin });
    const cliente = roles.cuerpo.datos.find((r) => r.nombre === 'Cliente');
    const r = await e.api(`/usuarios/${yo.cuerpo.usuario.id}`, { metodo: 'PUT', token: t.admin, cuerpo: { rolId: cliente.id } });
    assert.equal(r.estado, 422);
  });

  test('las contraseñas nuevas deben ser robustas', async () => {
    const r = await e.api('/usuarios', {
      metodo: 'POST',
      token: t.admin,
      cuerpo: {
        nombre: 'Clave Débil',
        tipoDocumento: 'CC',
        numeroDocumento: '99887766',
        correo: 'debil@mirallantas.com',
        rolId: t.rolAdmin,
        password: '12345678',
      },
    });
    assert.equal(r.estado, 422);
  });
});

describe('Sesiones e inicio de sesión', () => {
  test('cerrar sesión invalida el token', async () => {
    const token = (await login('pedro.m@mirallantas.com')).cuerpo.token;
    assert.equal((await e.api('/auth/salir', { metodo: 'POST', token })).estado, 204);
    assert.equal((await e.api('/auth/yo', { token })).estado, 401);
  });

  test('5 contraseñas incorrectas bloquean la cuenta 15 minutos', async () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await login('ana.rios@mirallantas.com', 'ClaveIncorrecta1')).estado, 401);
    }
    const conLaBuena = await login('ana.rios@mirallantas.com');
    assert.equal(conLaBuena.estado, 429, 'bloqueada aunque ahora acierte');

    // Queda en la bitácora (tabla evento_seguridad)
    const { rows } = await e.db.query(
      "SELECT 1 FROM evento_seguridad WHERE tipo = 'cuenta_bloqueada' AND correo = 'ana.rios@mirallantas.com'",
    );
    assert.equal(rows.length, 1);
    t.maria = (await login('maria@gmail.com')).cuerpo.token;
  });

  test('cambiar la contraseña exige la actual y cierra las demás sesiones', async () => {
    const sinActual = await e.api('/auth/yo', { metodo: 'PUT', token: t.maria, cuerpo: { password: 'NuevaClave2026' } });
    assert.equal(sinActual.estado, 422);

    const debil = await e.api('/auth/yo', {
      metodo: 'PUT',
      token: t.maria,
      cuerpo: { password: 'corta', passwordActual: e.passwordDemo },
    });
    assert.equal(debil.estado, 422);

    const ok = await e.api('/auth/yo', {
      metodo: 'PUT',
      token: t.maria,
      cuerpo: { password: 'NuevaClave2026', passwordActual: e.passwordDemo },
    });
    assert.equal(ok.estado, 200);
    assert.ok(ok.cuerpo.token);
    assert.equal((await e.api('/auth/yo', { token: t.maria })).estado, 401, 'la sesión anterior se cerró');
    t.maria = ok.cuerpo.token;
  });
});

describe('Archivos subidos', () => {
  test('rechaza un archivo que dice ser imagen pero no lo es', async () => {
    const falso = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
    const r = await e.api('/auth/yo', { metodo: 'PUT', token: t.maria, cuerpo: { foto: falso } });
    assert.equal(r.estado, 422);
  });

  test('rechaza SVG (puede llevar código)', async () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"/>').toString('base64')}`;
    const r = await e.api('/auth/yo', { metodo: 'PUT', token: t.maria, cuerpo: { foto: svg } });
    assert.equal(r.estado, 422);
  });

  test('acepta una imagen PNG real', async () => {
    const r = await e.api('/auth/yo', { metodo: 'PUT', token: t.maria, cuerpo: { foto: PNG } });
    assert.equal(r.estado, 200);
    assert.ok(r.cuerpo.usuario.foto);
  });

  test('rechaza direcciones de imágenes externas', async () => {
    const r = await e.api('/auth/yo', {
      metodo: 'PUT',
      token: t.maria,
      cuerpo: { foto: 'http://169.254.169.254/latest/meta-data' },
    });
    assert.equal(r.estado, 422);
  });
});

describe('Pagos sin duplicados', () => {
  test('el mismo abono enviado dos veces se registra una sola vez', async () => {
    const creditos = await e.api('/creditos', { token: t.maria });
    const credito = creditos.cuerpo.datos.find((c) => c.saldoPendiente > 0);
    assert.ok(credito, 'María tiene un crédito abierto en los datos de prueba');

    const clave = randomUUID();
    const enviar = () =>
      e.api(`/creditos/${credito.numero}/abonos`, {
        metodo: 'POST',
        token: t.maria,
        cabeceras: { 'Idempotency-Key': clave },
        cuerpo: { monto: 20000, medioPago: 'Efectivo' },
      });
    // Doble clic: las dos peticiones salen a la vez
    const [a, b] = await Promise.all([enviar(), enviar()]);
    assert.deepEqual([a.estado, b.estado].sort(), [200, 201]);
    assert.equal(a.cuerpo.datos.numero, b.cuerpo.datos.numero);

    const { rows } = await e.db.query('SELECT COUNT(*)::int AS n FROM abono WHERE clave_idempotencia = $1', [clave]);
    assert.equal(rows[0].n, 1);
  });

  test('una clave de idempotencia mal formada se rechaza', async () => {
    const r = await e.api('/creditos/CRE-001/abonos', {
      metodo: 'POST',
      token: t.maria,
      cabeceras: { 'Idempotency-Key': "1' OR '1'='1" },
      cuerpo: { monto: 20000, medioPago: 'Efectivo' },
    });
    assert.equal(r.estado, 400);
  });
});

describe('Inyección SQL', () => {
  test('la búsqueda trata el texto como dato, no como SQL', async () => {
    const r = await e.api(`/clientes?q=${encodeURIComponent("x' OR '1'='1")}`, { token: t.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.total, 0);
    const { rows } = await e.db.query('SELECT COUNT(*)::int AS n FROM cliente');
    assert.ok(rows[0].n > 0, 'la tabla sigue intacta');
  });
});

describe('Copias de seguridad', () => {
  /** Crea una base vacía en el mismo servidor de pruebas. */
  async function baseNueva(nombre) {
    await e.db.query(`CREATE DATABASE ${nombre}`);
    const url = e.databaseUrl.replace(/\/[^/]+$/, `/${nombre}`);
    await migrarArriba(url, { silencioso: true });
    return url;
  }

  test('un respaldo se restaura completo en una base nueva', async () => {
    const respaldo = await crearRespaldo(e.databaseUrl);
    const url = await baseNueva('restaurada');
    await restaurarRespaldo(url, respaldo);

    const copia = await crearRespaldo(url);
    for (const [tabla, filas] of Object.entries(respaldo.tablas)) {
      assert.equal(copia.tablas[tabla].length, filas.length, `la tabla ${tabla} quedó igual`);
    }
    // Restaurar sobre una base con datos se niega
    await assert.rejects(restaurarRespaldo(url, respaldo), /ya tiene datos/);
  });

  test('la limpieza deja solo al Administrador', async () => {
    const respaldo = await crearRespaldo(e.databaseUrl);
    const url = await baseNueva('limpia');
    await restaurarRespaldo(url, respaldo);

    const admins = await limpiar(url);
    assert.deepEqual(admins, ['admin@mirallantas.com']);

    const despues = await crearRespaldo(url);
    assert.equal(despues.tablas.usuario.length, 1);
    assert.equal(despues.tablas.cliente.length, 0);
    assert.equal(despues.tablas.producto.length, 0);
    assert.deepEqual(despues.tablas.rol.map((r) => r.nombre).sort(), ['Administrador', 'Cliente']);
  });

  test('db:eliminargestion borra la gestión comercial y conserva lo demás', async () => {
    const respaldo = await crearRespaldo(e.databaseUrl);
    const url = await baseNueva('sin_gestion');
    await restaurarRespaldo(url, respaldo);
    assert.ok(respaldo.tablas.cotizacion.length > 0, 'la base de prueba trae cotizaciones');

    const resumen = Object.fromEntries(await eliminarGestion(url));
    assert.equal(resumen['Pedidos-cotización'], respaldo.tablas.cotizacion.length);

    const despues = await crearRespaldo(url);
    for (const tabla of ['cotizacion', 'cotizacion_detalle', 'compra', 'compra_detalle', 'solicitud_servicio', 'credito', 'abono', 'solicitud_credito']) {
      assert.equal(despues.tablas[tabla].length, 0, `${tabla} quedó vacía`);
    }
    // Las ventas directas quedan; las de cotizaciones, no
    assert.ok(despues.tablas.venta.every((v) => v.cotizacion_id === null));
    // Lo demás no se toca
    for (const tabla of ['cliente', 'usuario', 'producto', 'proveedor', 'rol']) {
      assert.equal(despues.tablas[tabla].length, respaldo.tablas[tabla].length, `${tabla} se conserva`);
    }
    // Solo se ejecuta sin el permiso extra en la base local
    assert.equal(esLocal('postgres://u:c@localhost:5433/db'), true);
    assert.equal(esLocal('postgres://u:c@db.abc.supabase.co:5432/postgres'), false);
  });
});
