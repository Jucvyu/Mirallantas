import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Captcha del inicio de sesión. Cloudflare se reemplaza por un servidor
 * local que solo aprueba el token "token-bueno".
 */

let e;
let cloudflare;

before(async () => {
  cloudflare = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (parte) => (cuerpo += parte));
    req.on('end', () => {
      const datos = new URLSearchParams(cuerpo);
      const success = datos.get('secret') === 'secreto-de-prueba' && datos.get('response') === 'token-bueno';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success }));
    });
  });
  await new Promise((listo) => cloudflare.listen(0, listo));
  e = await levantarEntorno({
    variables: {
      TURNSTILE_SECRET_KEY: 'secreto-de-prueba',
      TURNSTILE_VERIFY_URL: `http://localhost:${cloudflare.address().port}/siteverify`,
    },
  });
});

after(async () => {
  await e?.cerrar();
  cloudflare?.close();
});

describe('Captcha del inicio de sesión', () => {
  const entrar = (captcha) =>
    e.api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'admin@mirallantas.com', password: e.passwordDemo, ...(captcha ? { captcha } : {}) },
    });

  test('sin hacer la prueba no inicia sesión', async () => {
    const r = await entrar();
    assert.equal(r.estado, 400);
    assert.match(r.cuerpo.error, /verificación de seguridad/);
  });

  test('si no la supera tampoco, aunque la contraseña sea correcta', async () => {
    const r = await entrar('token-falso');
    assert.equal(r.estado, 400);
    assert.match(r.cuerpo.error, /No superaste/);
  });

  test('superada, inicia sesión', async () => {
    const r = await entrar('token-bueno');
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    assert.ok(r.cuerpo.token, 'entrega la sesión');
  });

  test('crear una cuenta, pedir el código de recuperación y "Solicitar cotización" también lo exigen', async () => {
    const cuenta = (captcha) =>
      e.api('/auth/registro', {
        metodo: 'POST',
        cuerpo: {
          nombre: 'Camila Rojas',
          tipoDocumento: 'CC',
          numeroDocumento: '1012345678',
          telefono: '3115557788',
          correo: 'camila.captcha@ejemplo.com',
          password: 'ClaveSegura2026',
          ...(captcha ? { captcha } : {}),
        },
      });
    assert.equal((await cuenta()).estado, 400, 'sin captcha no se crea');
    assert.equal((await cuenta('token-falso')).estado, 400);
    assert.equal((await cuenta('token-bueno')).estado, 201);

    const recuperar = (captcha) =>
      e.api('/auth/recuperar/solicitar', { metodo: 'POST', cuerpo: { correo: 'admin@mirallantas.com', ...(captcha ? { captcha } : {}) } });
    assert.equal((await recuperar()).estado, 400, 'sin captcha no se envía el código');

    const verificar = (captcha) => e.api('/auth/captcha', { metodo: 'POST', cuerpo: captcha ? { captcha } : {} });
    assert.equal((await verificar()).estado, 400);
    assert.equal((await verificar('token-falso')).estado, 400);
    assert.equal((await verificar('token-bueno')).estado, 204);
  });
});
