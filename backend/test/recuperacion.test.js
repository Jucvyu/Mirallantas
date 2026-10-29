import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de "¿Olvidaste tu contraseña?": intentos por correo, bloqueo de
 * 2 minutos, código por correo con 3 intentos y cambio de contraseña.
 */

let e;
let bandeja;

before(async () => {
  e = await levantarEntorno();
  // Sin SMTP, los correos quedan en la bandeja de desarrollo
  ({ bandejaDesarrollo: bandeja } = await import('../src/utils/correo.js'));
});

after(async () => {
  await e?.cerrar();
});

// Todas las peticiones salen de la misma IP: cada prueba empieza sin bloqueo
beforeEach(async () => {
  await e.db.query('DELETE FROM bloqueo_recuperacion');
});

const solicitar = (correo) => e.api('/auth/recuperar/solicitar', { metodo: 'POST', cuerpo: { correo } });
const verificar = (solicitud, codigo) =>
  e.api('/auth/recuperar/verificar', { metodo: 'POST', cuerpo: { solicitud, codigo } });
const cambiar = (solicitud, password) =>
  e.api('/auth/recuperar/cambiar', { metodo: 'POST', cuerpo: { solicitud, password } });

/** Código de 6 dígitos del último correo enviado. */
const ultimoCodigo = () => bandeja.at(-1).texto.match(/\b(\d{6})\b/)[1];

describe('Paso 1: buscar el correo', () => {
  test('un correo que no existe responde igual que uno registrado (no revela quién tiene cuenta)', async () => {
    const enviados = bandeja.length;
    const inexistente = await solicitar('nadie@ejemplo.com');
    const registrado = await solicitar('maria@gmail.com');
    assert.equal(inexistente.estado, 200);
    assert.deepEqual(Object.keys(inexistente.cuerpo).sort(), Object.keys(registrado.cuerpo).sort());
    assert.match(inexistente.cuerpo.correo, /^na\*+@ejemplo\.com$/);
    assert.equal(bandeja.length, enviados + 1, 'solo se envió el correo de la cuenta registrada');

    // Su código nunca se verifica: no hay a quién cambiarle la contraseña
    const { rows } = await e.db.query('SELECT usuario_id FROM recuperacion_password WHERE id = $1', [inexistente.cuerpo.solicitud]);
    assert.equal(rows[0].usuario_id, null);
    assert.equal((await verificar(inexistente.cuerpo.solicitud, '123456')).estado, 422);
  });

  test('un correo que no existe descuenta intentos y al sexto bloquea 1 minuto', async () => {
    await e.db.query('DELETE FROM bloqueo_recuperacion');
    for (const quedan of [4, 3, 2, 1, 0]) {
      const r = await solicitar('nadie@ejemplo.com');
      assert.equal(r.estado, 200);
      assert.equal(r.cuerpo.intentosRestantes, quedan);
    }
    const sexto = await solicitar('nadie@ejemplo.com');
    assert.equal(sexto.estado, 429);
    assert.ok(sexto.cuerpo.bloqueadoHasta);

    // Bloqueada: ni siquiera con un correo que sí existe
    const bloqueada = await solicitar('maria@gmail.com');
    assert.equal(bloqueada.estado, 429);

    const estado = await e.api('/auth/recuperar/estado');
    assert.equal(estado.cuerpo.intentosRestantes, 0);
    assert.ok(new Date(estado.cuerpo.bloqueadoHasta) > new Date());
  });

  test('pasado el bloqueo, la IP recupera sus 5 intentos', async () => {
    await e.db.query(
      "INSERT INTO bloqueo_recuperacion (ip, intentos_restantes, bloqueado_hasta) VALUES ('::/56', 0, now() - interval '1 second'), ('127.0.0.1', 0, now() - interval '1 second')",
    );
    const estado = await e.api('/auth/recuperar/estado');
    assert.equal(estado.cuerpo.intentosRestantes, 5);
    assert.equal(estado.cuerpo.bloqueadoHasta, null);
  });

  test('máximo 5 códigos por IP (aunque el correo exista); luego espera 1 minuto', async () => {
    await e.db.query('DELETE FROM bloqueo_recuperacion');
    for (const quedan of [4, 3, 2, 1, 0]) {
      const r = await solicitar('maria@gmail.com');
      assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
      assert.equal(r.cuerpo.intentosRestantes, quedan);
    }
    const sexto = await solicitar('maria@gmail.com');
    assert.equal(sexto.estado, 429);
    assert.match(sexto.cuerpo.error, /1 minuto/);
    const segundos = (new Date(sexto.cuerpo.bloqueadoHasta) - Date.now()) / 1000;
    assert.ok(segundos > 0 && segundos <= 61, `el bloqueo dura 1 minuto (${segundos} s)`);
    await e.db.query('DELETE FROM bloqueo_recuperacion');
  });

  test('con un correo registrado envía el código y no lo guarda en claro', async () => {
    const r = await solicitar('maria@gmail.com');
    assert.equal(r.estado, 200);
    assert.match(r.cuerpo.correo, /^ma\*+@gmail\.com$/);
    assert.equal(bandeja.at(-1).para, 'maria@gmail.com');

    const { rows } = await e.db.query('SELECT codigo_hash FROM recuperacion_password WHERE id = $1', [r.cuerpo.solicitud]);
    assert.notEqual(rows[0].codigo_hash, ultimoCodigo());
  });
});

describe('Pasos 2 y 3: código y contraseña nueva', () => {
  test('3 códigos incorrectos anulan la solicitud y bloquean la vista', async () => {
    const { cuerpo } = await solicitar('lfmora@yahoo.com');
    const codigo = ultimoCodigo();
    const malo = codigo === '000000' ? '111111' : '000000';

    assert.equal((await verificar(cuerpo.solicitud, malo)).cuerpo.intentosCodigo, 2);
    assert.equal((await verificar(cuerpo.solicitud, malo)).cuerpo.intentosCodigo, 1);
    const tercero = await verificar(cuerpo.solicitud, malo);
    assert.equal(tercero.estado, 429);
    assert.ok(tercero.cuerpo.bloqueadoHasta);

    // Aunque ahora acierte, la solicitud ya no sirve
    await e.db.query('DELETE FROM bloqueo_recuperacion');
    assert.equal((await verificar(cuerpo.solicitud, codigo)).estado, 410);
  });

  test('sin verificar el código no se puede cambiar la contraseña', async () => {
    const { cuerpo } = await solicitar('lfmora@yahoo.com');
    assert.equal((await cambiar(cuerpo.solicitud, 'ClaveNueva2026')).estado, 410);
  });

  test('con el código correcto cambia la contraseña y cierra las sesiones', async () => {
    const tokenViejo = await e.iniciarSesion('pedro.m@mirallantas.com');
    const { cuerpo } = await solicitar('pedro.m@mirallantas.com');
    assert.equal((await verificar(cuerpo.solicitud, ultimoCodigo())).estado, 200);

    assert.equal((await cambiar(cuerpo.solicitud, 'corta')).estado, 422, 'la contraseña debe ser robusta');
    const ok = await cambiar(cuerpo.solicitud, 'ClaveNueva2026');
    assert.equal(ok.estado, 200);

    assert.equal((await e.api('/auth/yo', { token: tokenViejo })).estado, 401);
    const login = await e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'pedro.m@mirallantas.com', password: 'ClaveNueva2026' },
    });
    assert.equal(login.estado, 200);

    // La solicitud no se puede reutilizar
    assert.equal((await cambiar(cuerpo.solicitud, 'OtraClave2026')).estado, 410);
  });

  test('un código nuevo anula el anterior', async () => {
    const primera = (await solicitar('maria@gmail.com')).cuerpo;
    const codigoViejo = ultimoCodigo();
    await solicitar('maria@gmail.com');
    assert.equal((await verificar(primera.solicitud, codigoViejo)).estado, 410);
  });
});
