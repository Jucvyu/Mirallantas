import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { afecta } from '../../frontend/src/services/dependencias.js';
import { levantarEntorno } from './entorno.js';
import { conectarSocket } from './socket.js';

/**
 * Prueba de saturación del tiempo real.
 *
 * Simula pestañas abiertas del panel que se comportan como el navegador
 * (services/tiempoReal.js + hooks/useAlCambiar.js del frontend): cada una
 * tiene su conexión de Socket.IO, al recibir "cambio" recarga SOLO los
 * listados que dependen de lo que cambió (juntando los avisos seguidos en
 * una recarga) y al recibir "notificacion" revisa su campana.
 *
 * Con el límite de peticiones ENCENDIDO (200 fichas por usuario y minuto,
 * como en producción) se le mete una ráfaga de cambios y muchas conexiones
 * a la vez. La página pasa si:
 *   - ninguna petición recibe 429 (límite) ni 5xx (error del servidor);
 *   - la ráfaga se agrupa en pocos avisos y pocas recargas por pestaña;
 *   - las notificaciones solo hacen trabajar a quien van dirigidas;
 *   - nadie abre más de 10 conexiones a la vez.
 */

let e;
const t = {};
const abiertos = [];
const FICHAS = 200;
/** Igual que el frontend: avisos seguidos se atienden una vez. */
const ESPERA_RECARGA_MS = 400;
const ESPERA_MAXIMA_MS = 2000;
const ESPERA_CAMPANA_MS = 300;

const dormir = (ms) => new Promise((listo) => setTimeout(listo, ms));

/** Todas las respuestas de la prueba, para revisar al final que ninguna falló. */
const respuestas = [];
async function pedir(ruta, opciones) {
  const inicio = performance.now();
  const r = await e.api(ruta, opciones);
  respuestas.push({ ruta, estado: r.estado, ms: performance.now() - inicio });
  return r;
}

/**
 * Pestaña del panel abierta en una pantalla: `listados` son las rutas que
 * pide (lo que hacen sus useRecurso) y `mira` los recursos de los que depende.
 */
async function abrirPestana(token, { listados, mira, campana = '/notificaciones' }) {
  const socket = await conectarSocket(e.origen, token);
  abiertos.push(socket);

  const p = { socket, avisos: 0, recargas: 0, revisionesCampana: 0 };
  let recarga = null;
  let revision = null;
  let desde = null;
  socket.on('cambio', ({ recursos }) => {
    p.avisos++;
    if (!afecta(recursos, mira)) return;
    clearTimeout(recarga);
    desde ??= Date.now();
    recarga = setTimeout(async () => {
      desde = null;
      p.recargas++;
      await Promise.all(listados.map((ruta) => pedir(`${ruta}?porPagina=100&pagina=1`, { token })));
    }, Math.max(0, Math.min(ESPERA_RECARGA_MS, desde + ESPERA_MAXIMA_MS - Date.now())));
  });
  socket.on('notificacion', () => {
    clearTimeout(revision);
    revision = setTimeout(async () => {
      p.revisionesCampana++;
      await pedir(campana, { token });
    }, ESPERA_CAMPANA_MS);
  });
  return p;
}

// La pantalla de Productos pide categorías, marcas, vehículos, productos y medidas
const PRODUCTOS = { listados: ['/categorias', '/marcas', '/tipos-vehiculo', '/modelos', '/productos'], mira: ['productos', 'modelos', 'categorias', 'marcas', 'tipos-vehiculo'] };
// La de Roles solo depende de la seguridad
const ROLES = { listados: ['/roles'], mira: ['roles'] };

before(async () => {
  e = await levantarEntorno({ variables: { LIMITE_API_FICHAS: String(FICHAS), LIMITE_API_POR_MINUTO: String(FICHAS) } });
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
  t.maria = await e.iniciarSesion('maria@gmail.com');
  t.luis = await e.iniciarSesion('lfmora@yahoo.com');
});

after(async () => {
  for (const s of abiertos) s.disconnect();
  await e?.cerrar();
});

describe('Saturación: ráfaga de cambios con varias pestañas abiertas', () => {
  test('60 cambios seguidos con 6 pestañas abiertas no agotan el límite ni dan error', async () => {
    const productos = await Promise.all(Array.from({ length: 5 }, () => abrirPestana(t.admin, PRODUCTOS)));
    const roles = await abrirPestana(t.admin, ROLES);

    // Ráfaga: 40 marcas nuevas de 8 en 8 y luego 20 más, una cada 50 ms
    for (let lote = 0; lote < 5; lote++) {
      await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          pedir('/marcas', { metodo: 'POST', token: t.admin, cuerpo: { nombre: `Saturación ${lote}-${i}` } }),
        ),
      );
    }
    for (let i = 0; i < 20; i++) {
      await pedir('/marcas', { metodo: 'POST', token: t.admin, cuerpo: { nombre: `Saturación pausada ${i}` } });
      await dormir(50);
    }
    // Que terminen las recargas pendientes
    await dormir(1500);

    const fallidas = respuestas.filter((r) => r.estado === 429 || r.estado >= 500);
    assert.deepEqual(fallidas, [], 'ninguna petición choca con el límite ni falla');

    const avisos = Math.max(...productos.map((p) => p.avisos));
    const recargas = Math.max(...productos.map((p) => p.recargas));
    const peticiones = respuestas.length;
    console.log(`  60 cambios → ${avisos} avisos por pestaña, ${recargas} recargas por pestaña, ${peticiones} peticiones en total (límite ${FICHAS})`);
    assert.ok(avisos <= 15, `60 cambios se agrupan en pocos avisos (llegaron ${avisos})`);
    assert.ok(recargas <= avisos, 'una pestaña no recarga más veces que avisos recibe');
    assert.ok(productos.every((p) => p.recargas >= 1), 'cada pestaña de Productos se puso al día');
    assert.ok(peticiones < FICHAS, `todo cabe en el límite de un minuto (${peticiones} peticiones)`);
    assert.equal(roles.recargas, 0, 'la pantalla de Roles no recarga por cambios del catálogo');
  });
});

describe('Saturación: muchas conexiones a la vez', () => {
  test('10 pestañas por usuario como máximo; la 11 se rechaza', async () => {
    const token = await e.iniciarSesion('lfmora@yahoo.com');
    const portal = { listados: ['/portal/resumen'], mira: ['portal'], campana: '/portal/notificaciones' };
    for (let i = 0; i < 10; i++) await abrirPestana(token, portal);
    await assert.rejects(abrirPestana(token, portal), /DEMASIADAS_PESTANAS/);
  });

  test('con 30 conexiones abiertas, 150 consultas a la vez responden sin error y rápido', async () => {
    // Tres usuarios con 10 pestañas cada uno; las consultas se reparten entre
    // cuatro (el límite es por usuario: aquí se mide la carga, no el límite)
    const usuarios = await Promise.all(
      ['ana.rios@mirallantas.com', 'pedro.m@mirallantas.com', 'maria@gmail.com', 'lfmora@yahoo.com'].map((c) => e.iniciarSesion(c)),
    );
    // Al iniciar sesión de nuevo se cortaron sus pestañas anteriores: caben 10 más
    for (const token of usuarios.slice(0, 3)) {
      for (let i = 0; i < 10; i++) await abrirPestana(token, ROLES);
    }
    respuestas.length = 0;
    const inicio = performance.now();
    await Promise.all(Array.from({ length: 150 }, (_, i) => pedir('/productos?porPagina=20', { token: usuarios[i % usuarios.length] })));
    const total = performance.now() - inicio;
    const tiempos = respuestas.map((r) => r.ms).sort((a, b) => a - b);
    const p95 = tiempos[Math.floor(tiempos.length * 0.95)];
    console.log(`  150 consultas con 30 conexiones abiertas: ${Math.round(total)} ms en total, p95 ${Math.round(p95)} ms`);
    assert.deepEqual(respuestas.filter((r) => r.estado >= 500 || r.estado === 429), []);
    assert.ok(p95 < 3000, `p95 ${Math.round(p95)} ms`);
  });
});

describe('Saturación: las notificaciones no despiertan a todos', () => {
  test('una notificación para María solo hace revisar la campana de sus pestañas', async () => {
    const maria = await e.iniciarSesion('maria@gmail.com');
    const luis = await e.iniciarSesion('lfmora@yahoo.com');
    const portal = { listados: ['/portal/resumen'], mira: ['portal'], campana: '/portal/notificaciones' };
    const deMaria = await Promise.all(Array.from({ length: 3 }, () => abrirPestana(maria, portal)));
    const deLuis = await Promise.all(Array.from({ length: 3 }, () => abrirPestana(luis, portal)));
    const delPersonal = await abrirPestana(t.admin, ROLES);

    const { rows } = await e.db.query("SELECT cliente_id FROM usuario WHERE correo = 'maria@gmail.com'");
    const { crear } = await import('../src/models/notificaciones.model.js');
    // Cinco avisos seguidos: se atienden en una sola revisión por pestaña
    for (let i = 0; i < 5; i++) await crear({ clienteId: rows[0].cliente_id, titulo: `Aviso ${i}`, mensaje: 'Prueba' });
    await dormir(1200);

    assert.ok(deMaria.every((p) => p.revisionesCampana === 1), 'cada pestaña de María revisa una vez');
    assert.ok(deLuis.every((p) => p.revisionesCampana === 0), 'las de Luis no hacen nada');
    assert.equal(delPersonal.revisionesCampana, 0, 'el personal no la recibe');
  });
});
