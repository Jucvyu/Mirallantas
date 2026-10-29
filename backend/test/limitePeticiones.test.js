import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Límite de peticiones con un cubo de fichas por usuario. Aquí el cubo es
 * de 5 fichas y se recarga a 5 por minuto (una cada 12 segundos).
 */

let e;
const t = {};

before(async () => {
  e = await levantarEntorno({ variables: { LIMITE_API_FICHAS: '5' } });
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
});

after(async () => {
  await e?.cerrar();
});

const idDe = async (correo) => (await e.db.query('SELECT id FROM usuario WHERE correo = $1', [correo])).rows[0].id;
const cubo = async (clave) => (await e.db.query('SELECT * FROM cubo_fichas WHERE clave = $1', [clave])).rows[0];

describe('Cubo de fichas', () => {
  test('gasta una ficha por petición y con el cubo vacío responde 429', async () => {
    const clave = `u:${await idDe('admin@mirallantas.com')}`;

    for (let i = 4; i >= 0; i--) {
      const r = await e.api('/auth/yo', { token: t.admin });
      assert.equal(r.estado, 200);
      assert.equal(r.cabeceras.get('ratelimit-policy'), '"cubo";q=5;w=60');
      assert.match(r.cabeceras.get('ratelimit'), new RegExp(`^"cubo";r=${i};t=\\d+$`));
    }

    const rechazada = await e.api('/auth/yo', { token: t.admin });
    assert.equal(rechazada.estado, 429);
    assert.equal(rechazada.cuerpo.codigo, 'LIMITE_PETICIONES');
    const espera = Number(rechazada.cabeceras.get('retry-after'));
    assert.ok(espera >= 1 && espera <= 12, `Retry-After = ${espera}`);

    // Se guardan las fichas que quedan y la hora de la última recarga
    const fila = await cubo(clave);
    assert.ok(fila.fichas < 1);
    assert.ok(fila.ultima_recarga instanceof Date);
  });

  test('cada usuario tiene su propio cubo', async () => {
    const r = await e.api('/auth/yo', { token: t.luis });
    assert.equal(r.estado, 200);
  });

  test('se rellena con el tiempo sin pasar de la capacidad', async () => {
    const clave = `u:${await idDe('admin@mirallantas.com')}`;
    // Simula que pasó una hora sin peticiones
    await e.db.query("UPDATE cubo_fichas SET ultima_recarga = now() - interval '1 hour' WHERE clave = $1", [clave]);

    const r = await e.api('/auth/yo', { token: t.admin });
    assert.equal(r.estado, 200);
    // Lleno (5) menos la ficha de esta petición
    assert.match(r.cabeceras.get('ratelimit'), /^"cubo";r=4;/);
  });

  test('sin sesión, el cubo es de la IP', async () => {
    await e.api('/catalogo');
    const { rows } = await e.db.query("SELECT clave FROM cubo_fichas WHERE clave LIKE 'ip:%'");
    assert.ok(rows.length >= 1);
  });
});
