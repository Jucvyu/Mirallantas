import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de "¿Olvidaste tu contraseña?" con enlace de un solo uso:
 * respuesta genérica, límite por IP, token guardado solo como huella,
 * vencimiento, uso único y cierre de sesiones.
 *
 * Sin RESEND_API_KEY (como en las pruebas) los correos quedan en la bandeja
 * de desarrollo: así se lee el enlace que habría recibido el usuario.
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

// Todas las peticiones salen de la misma IP: cada prueba empieza sin límite
beforeEach(async () => {
  await e.db.query('DELETE FROM bloqueo_recuperacion');
});

const solicitar = (correo) => e.api('/auth/recuperar/solicitar', { metodo: 'POST', cuerpo: { correo } });
const validarToken = (token) => e.api('/auth/recuperar/validar', { metodo: 'POST', cuerpo: { token } });
const restablecer = (token, password) =>
  e.api('/auth/recuperar/restablecer', { metodo: 'POST', cuerpo: { token, password } });

/** Token del enlace del último correo enviado. */
const ultimoToken = () => bandeja.at(-1).texto.match(/#token=([A-Za-z0-9_-]{43})/)[1];

describe('Solicitar el enlace', () => {
  test('la respuesta es la misma exista o no el correo (no revela cuentas)', async () => {
    const antes = bandeja.length;
    const inexistente = await solicitar('nadie@ejemplo.com');
    const registrado = await solicitar('maria@gmail.com');
    assert.equal(inexistente.estado, 200);
    assert.equal(registrado.estado, 200);
    assert.deepEqual(inexistente.cuerpo, registrado.cuerpo);
    assert.equal(bandeja.length, antes + 1, 'solo la cuenta registrada recibe correo');
    assert.equal(bandeja.at(-1).para, 'maria@gmail.com');
  });

  test('el enlace apunta al frontend, lleva el token en el fragmento y solo se guarda su huella', async () => {
    await solicitar('maria@gmail.com');
    const { texto } = bandeja.at(-1);
    assert.match(texto, /http:\/\/localhost:5173\/restablecer-contrasena#token=/);
    const token = ultimoToken();
    const { rows } = await e.db.query(
      `SELECT r.token_hash, r.expira_en > now() + interval '25 minutes' AS dura
         FROM recuperacion_password r JOIN usuario u ON u.id = r.usuario_id
        WHERE u.correo = 'maria@gmail.com' AND NOT r.usado`,
    );
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, token, 'el token no se guarda en claro');
    assert.equal(rows[0].dura, true, 'vence en 30 minutos');
  });

  test('una cuenta inactiva no recibe enlace y la respuesta es la misma', async () => {
    const { rows } = await e.db.query("SELECT correo FROM usuario WHERE NOT activo LIMIT 1");
    const antes = bandeja.length;
    const r = await solicitar(rows[0].correo);
    assert.equal(r.estado, 200);
    assert.equal(bandeja.length, antes);
  });

  test('cada IP puede pedir 5 enlaces; luego espera', async () => {
    for (let i = 0; i < 5; i += 1) assert.equal((await solicitar('nadie@ejemplo.com')).estado, 200);
    const bloqueada = await solicitar('nadie@ejemplo.com');
    assert.equal(bloqueada.estado, 429);
    assert.match(bloqueada.cuerpo.error, /Espera 15 minutos/);
  });
});

describe('Usar el enlace', () => {
  test('un token inválido o inventado se rechaza', async () => {
    assert.equal((await validarToken('corto')).estado, 422);
    assert.equal((await validarToken('A'.repeat(43))).estado, 410);
    assert.equal((await restablecer('A'.repeat(43), 'ClaveNueva2026')).estado, 410);
  });

  test('con el enlace vigente cambia la contraseña, cierra las sesiones y no se reutiliza', async () => {
    const sesionVieja = await e.iniciarSesion('maria@gmail.com');
    await solicitar('maria@gmail.com');
    const token = ultimoToken();

    assert.equal((await validarToken(token)).estado, 200);
    // El token no sirve como sesión
    assert.equal((await e.api('/auth/yo', { token })).estado, 401);

    const r = await restablecer(token, 'ClaveNueva2026');
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.equal((await e.api('/auth/yo', { token: sesionVieja })).estado, 401, 'la sesión anterior se cerró');
    assert.ok(await e.iniciarSesion('maria@gmail.com', 'ClaveNueva2026'));

    // Ya usado: no vuelve a servir
    assert.equal((await restablecer(token, 'OtraClave2026')).estado, 410);
    assert.equal((await validarToken(token)).estado, 410);
  });

  test('un enlace nuevo anula el anterior', async () => {
    await solicitar('lfmora@yahoo.com');
    const viejo = ultimoToken();
    await solicitar('lfmora@yahoo.com');
    const nuevo = ultimoToken();
    assert.equal((await validarToken(viejo)).estado, 410);
    assert.equal((await validarToken(nuevo)).estado, 200);
  });

  test('un enlace vencido se rechaza', async () => {
    await solicitar('lfmora@yahoo.com');
    const token = ultimoToken();
    await e.db.query(
      `UPDATE recuperacion_password SET expira_en = now() - interval '1 minute'
        WHERE usuario_id = (SELECT id FROM usuario WHERE correo = 'lfmora@yahoo.com') AND NOT usado`,
    );
    assert.equal((await restablecer(token, 'ClaveNueva2026')).estado, 410);
  });

  test('la contraseña nueva debe cumplir las reglas', async () => {
    await solicitar('lfmora@yahoo.com');
    const r = await restablecer(ultimoToken(), 'corta');
    assert.equal(r.estado, 422);
  });
});
