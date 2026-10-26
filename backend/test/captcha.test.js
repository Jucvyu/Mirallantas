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
});
