import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { codigoActual } from '../src/utils/totp.js';
import { levantarEntorno } from './entorno.js';

/**
 * Ataques que se probaron contra la API (revisión de seguridad) y que ya no
 * funcionan. Cada prueba repite el ataque y comprueba que se frena.
 */

let e;
let bandeja;

before(async () => {
  e = await levantarEntorno();
  ({ bandejaDesarrollo: bandeja } = await import('../src/utils/correo.js'));
});

after(async () => {
  await e?.cerrar();
});

describe('Recuperar contraseña: adivinar el código en paralelo', () => {
  test('aunque lleguen 15 códigos a la vez, solo se cuentan 3 intentos', async () => {
    await e.db.query('DELETE FROM bloqueo_recuperacion');
    const pedido = await e.api('/auth/recuperar/solicitar', { metodo: 'POST', cuerpo: { correo: 'pedro.m@mirallantas.com' } });
    assert.equal(pedido.estado, 200);
    const correcto = bandeja.at(-1).texto.match(/\b(\d{6})\b/)[1];

    // 15 códigos equivocados al mismo tiempo (como haría un programa)
    const equivocados = Array.from({ length: 15 }, (_, i) => String((Number(correcto) + i + 1) % 1_000_000).padStart(6, '0'));
    const respuestas = await Promise.all(
      equivocados.map((codigo) =>
        e.api('/auth/recuperar/verificar', { metodo: 'POST', cuerpo: { solicitud: pedido.cuerpo.solicitud, codigo } }),
      ),
    );
    const revisados = respuestas.filter((r) => r.estado === 422 || r.cuerpo.intentosCodigo === 0);
    assert.ok(revisados.length <= 3, `se revisaron ${revisados.length} códigos`);

    // La solicitud quedó anulada: ni el código correcto sirve ya
    await e.db.query('DELETE FROM bloqueo_recuperacion');
    const tarde = await e.api('/auth/recuperar/verificar', {
      metodo: 'POST',
      cuerpo: { solicitud: pedido.cuerpo.solicitud, codigo: correcto },
    });
    assert.equal(tarde.estado, 410);
  });
});

describe('Portal: cuenta Cliente sin ficha de cliente', () => {
  test('no se trata como personal ni ve los documentos de todos', async () => {
    const token = await e.iniciarSesion('maria@gmail.com');
    const { rows } = await e.db.query("SELECT cliente_id FROM usuario WHERE correo = 'maria@gmail.com'");
    await e.db.query("UPDATE usuario SET cliente_id = NULL WHERE correo = 'maria@gmail.com'");
    try {
      const r = await e.api('/cotizaciones', { token });
      assert.equal(r.estado, 403);
    } finally {
      await e.db.query("UPDATE usuario SET cliente_id = $1 WHERE correo = 'maria@gmail.com'", [rows[0].cliente_id]);
    }
  });
});

describe('Doble factor: reutilizar un código', () => {
  test('el mismo código no sirve para entrar dos veces', async () => {
    const token = await e.iniciarSesion('ana.rios@mirallantas.com');
    const { cuerpo } = await e.api('/auth/2fa/configurar', { metodo: 'POST', token });
    const activar = await e.api('/auth/2fa/activar', {
      metodo: 'POST',
      token,
      cuerpo: { codigo: codigoActual(cuerpo.secreto) },
    });
    assert.equal(activar.estado, 200);

    const entrar = async (codigo) => {
      const paso1 = await e.api('/auth/login', {
        metodo: 'POST',
        cuerpo: { correo: 'ana.rios@mirallantas.com', password: e.passwordDemo },
      });
      return e.api('/auth/2fa/verificar', { metodo: 'POST', cuerpo: { desafio: paso1.cuerpo.desafio, codigo } });
    };
    const codigo = codigoActual(cuerpo.secreto);
    assert.equal((await entrar(codigo)).estado, 200);
    // Alguien que vio el código intenta usarlo mientras sigue vigente
    const repetido = await entrar(codigo);
    assert.equal(repetido.estado, 401);
    assert.match(repetido.cuerpo.error, /ya se usó/);
  });
});

describe('Cuerpos enormes sin sesión', () => {
  test('sin sesión se rechaza un cuerpo de más de 100 KB', async () => {
    const r = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'x@ejemplo.com', password: 'a'.repeat(200_000) },
    });
    assert.equal(r.estado, 413);
  });

  test('con sesión se aceptan cuerpos grandes (fotos)', async () => {
    const token = await e.iniciarSesion('admin@mirallantas.com');
    const r = await e.api('/auth/yo', { metodo: 'PUT', token, cuerpo: { nombre: 'a'.repeat(200_000) } });
    assert.notEqual(r.estado, 413);
  });
});

describe('Bloquear la cuenta de otra persona', () => {
  const login = (password) =>
    e.api('/auth/login', { metodo: 'POST', cuerpo: { correo: 'pedro.m@mirallantas.com', password } });

  test('5 contraseñas erradas bloquean solo a la IP que las escribió', async () => {
    for (let i = 0; i < 5; i += 1) assert.equal((await login('ClaveIncorrecta1')).estado, 401);
    assert.equal((await login(e.passwordDemo)).estado, 429, 'esta IP queda bloqueada');

    // Si el bloqueo hubiera sido de otra IP (el atacante), el dueño entra
    await e.db.query(
      "UPDATE bloqueo_inicio SET ip = '203.0.113.9' FROM usuario u WHERE u.id = usuario_id AND u.correo = 'pedro.m@mirallantas.com'",
    );
    assert.equal((await login(e.passwordDemo)).estado, 200);
  });

  test('un ataque repartido entre muchas IP sí bloquea la cuenta para todos', async () => {
    const id = (await e.db.query("SELECT id FROM usuario WHERE correo = 'pedro.m@mirallantas.com'")).rows[0].id;
    // 29 fallos desde otras IP y uno más desde esta llegan al tope general (30)
    await e.db.query('UPDATE usuario SET intentos_fallidos = 29 WHERE id = $1', [id]);
    assert.equal((await login('ClaveIncorrecta1')).estado, 401);
    await e.db.query('DELETE FROM bloqueo_inicio WHERE usuario_id = $1', [id]);
    assert.equal((await login(e.passwordDemo)).estado, 429);
    await e.db.query('UPDATE usuario SET bloqueado_hasta = NULL WHERE id = $1', [id]);
  });
});

describe('Tiempo real después de cerrar sesión', () => {
  test('al cerrar sesión se corta la conexión abierta', async () => {
    const token = await e.iniciarSesion('admin@mirallantas.com');
    const abortar = new AbortController();
    const respuesta = await fetch(`${e.base}/eventos`, { headers: { Authorization: `Bearer ${token}` }, signal: abortar.signal });
    assert.equal(respuesta.status, 200);
    const lector = respuesta.body.getReader();
    await lector.read(); // "retry: 3000"

    assert.equal((await e.api('/auth/salir', { metodo: 'POST', token })).estado, 204);
    const cortada = await Promise.race([
      (async () => {
        for (;;) if ((await lector.read()).done) return true;
      })(),
      new Promise((listo) => setTimeout(() => listo(false), 3000)),
    ]);
    abortar.abort();
    assert.ok(cortada, 'la conexión se cerró');
  });
});

describe('Tiempo real: abrir conexiones sin límite', () => {
  test('cada usuario tiene máximo 10 conexiones abiertas', async () => {
    const token = await e.iniciarSesion('pedro.m@mirallantas.com');
    const abortar = new AbortController();
    const abrir = () =>
      fetch(`${e.base}/eventos`, { headers: { Authorization: `Bearer ${token}` }, signal: abortar.signal });
    try {
      const abiertas = [];
      for (let i = 0; i < 10; i++) abiertas.push(await abrir());
      assert.ok(abiertas.every((r) => r.status === 200));
      const sobra = await abrir();
      assert.equal(sobra.status, 429);
      await sobra.body?.cancel();
    } finally {
      abortar.abort();
    }
  });
});
