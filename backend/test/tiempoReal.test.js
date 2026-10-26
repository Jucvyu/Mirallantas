import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Tiempo real: una pantalla abierta (GET /api/eventos) recibe el aviso
 * cuando otra petición cambia datos.
 */

let e;
let token;

before(async () => {
  e = await levantarEntorno();
  token = await e.iniciarSesion('admin@mirallantas.com');
});

after(async () => {
  await e?.cerrar();
});

describe('Actualización en tiempo real', () => {
  test('sin sesión no se escucha', async () => {
    const r = await fetch(`${e.base}/eventos`);
    assert.equal(r.status, 401);
    await r.body?.cancel();
  });

  test('un cambio llega como aviso con el recurso que cambió', async () => {
    const abortar = new AbortController();
    const respuesta = await fetch(`${e.base}/eventos`, { headers: { Authorization: `Bearer ${token}` }, signal: abortar.signal });
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.headers.get('content-type'), /text\/event-stream/);

    const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
    // Un cambio cualquiera: una marca nueva
    await e.api('/marcas', { metodo: 'POST', token, cuerpo: { nombre: 'Marca en tiempo real' } });

    let recibido = '';
    const limite = Date.now() + 5000;
    while (!recibido.includes('event: cambio') && Date.now() < limite) {
      const { value, done } = await lector.read();
      if (done) break;
      recibido += value;
    }
    abortar.abort();
    assert.match(recibido, /event: cambio/);
    assert.match(recibido, /"marcas"/);
  });
});
