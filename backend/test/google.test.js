import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Pruebas de "Iniciar sesión con Google" que no necesitan a Google: lo que
 * no es un token firmado por Google se rechaza sin dar acceso.
 */

let e;

before(async () => {
  // Cada archivo de pruebas corre en su propio proceso: esto no afecta a los demás
  process.env.GOOGLE_CLIENT_ID = 'prueba.apps.googleusercontent.com';
  e = await levantarEntorno();
});

after(async () => {
  await e?.cerrar();
});

const conGoogle = (cuerpo) => e.api('/auth/google', { metodo: 'POST', cuerpo });

describe('Iniciar sesión con Google', () => {
  test('sin la respuesta de Google no entra', async () => {
    assert.equal((await conGoogle({})).estado, 422);
  });

  test('un token falso o inventado se rechaza', async () => {
    const falso = await conGoogle({ credencial: 'esto-no-es-un-token-de-google-1234567890' });
    assert.equal(falso.estado, 401);
    assert.equal(falso.cuerpo.token, undefined);

    // Con forma de JWT pero sin "kid" de Google
    const inventado = await conGoogle({ credencial: 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFkbWluQHguY29tIn0.firma' });
    assert.equal(inventado.estado, 401);
  });
});
