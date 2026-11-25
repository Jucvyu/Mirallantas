import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';
import { conectarSocket, esperarMensaje } from './socket.js';

/**
 * Tiempo real (Socket.IO): una pantalla abierta recibe el aviso cuando otra
 * petición cambia datos, y la campana recibe sus notificaciones al instante.
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
  test('sin sesión no se conecta', async () => {
    await assert.rejects(conectarSocket(e.origen, ''), /SESION_INVALIDA/);
    await assert.rejects(conectarSocket(e.origen, 'token-falso'), /SESION_INVALIDA/);
  });

  test('un cambio llega como aviso con el recurso que cambió', async () => {
    const socket = await conectarSocket(e.origen, token);
    try {
      const llega = esperarMensaje(socket, 'cambio');
      await e.api('/marcas', { metodo: 'POST', token, cuerpo: { nombre: 'Marca en tiempo real' } });
      const { recursos } = await llega;
      assert.ok(recursos.includes('marcas'));
    } finally {
      socket.close();
    }
  });

  test('una notificación nueva llega solo a la sala de su módulo', async () => {
    const socket = await conectarSocket(e.origen, token);
    try {
      const llega = esperarMensaje(socket, 'notificacion');
      const { crear } = await import('../src/models/notificacionesPersonal.model.js');
      await crear({ modulo: 'Reencauche', titulo: 'Prueba · REE-2026-999', mensaje: 'Aviso de prueba', tipo: 'alerta' });
      const aviso = await llega;
      assert.equal(aviso.titulo, 'Prueba · REE-2026-999');
      assert.equal(aviso.tipo, 'alerta');
    } finally {
      socket.close();
    }
  });
});
