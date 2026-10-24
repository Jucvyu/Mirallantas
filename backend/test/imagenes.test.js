import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

/**
 * Limpieza de imágenes: al borrar un registro o cambiar su foto, la base
 * anota las imágenes de Cloudinary que quedaron sin usar (migración 0015).
 */

const URL = (nombre) => `https://res.cloudinary.com/demo/image/upload/v1700000000/mirallantas/${nombre}.webp`;

let e;
const porBorrar = async () => (await e.db.query('SELECT url FROM imagen_por_borrar')).rows.map((r) => r.url);

before(async () => {
  e = await levantarEntorno();
});

after(async () => {
  await e?.cerrar();
});

describe('Imágenes que quedan sin usar', () => {
  test('el public_id sale de la dirección de Cloudinary', async () => {
    // (se importa aquí: el entorno de prueba prepara las variables antes)
    const { idPublico } = await import('../src/utils/limpiezaImagenes.js');
    assert.equal(idPublico(URL('abc-123')), 'mirallantas/abc-123');
  });

  test('cambiar la foto anota la anterior; borrar el registro anota las suyas', async () => {
    const { id } = (await e.db.query('SELECT id FROM usuario ORDER BY id DESC LIMIT 1')).rows[0];
    await e.db.query('UPDATE usuario SET foto_url = $1 WHERE id = $2', [URL('perfil-1'), id]);
    await e.db.query('UPDATE usuario SET foto_url = $1 WHERE id = $2', [URL('perfil-2'), id]);
    assert.ok((await porBorrar()).includes(URL('perfil-1')));
    assert.ok(!(await porBorrar()).includes(URL('perfil-2')), 'la foto actual sigue en uso');

    // Fotos de un reencauche: se borra la solicitud y se anotan todas
    const s = (await e.db.query('SELECT id FROM solicitud_servicio LIMIT 1')).rows[0];
    await e.db.query('UPDATE solicitud_servicio SET foto_url = $1, fotos = $2 WHERE id = $3', [
      URL('llanta-1'),
      [URL('llanta-1'), URL('llanta-2')],
      s.id,
    ]);
    await e.db.query('UPDATE solicitud_servicio SET fotos = $1 WHERE id = $2', [[URL('llanta-1')], s.id]);
    const anotadas = await porBorrar();
    assert.ok(anotadas.includes(URL('llanta-2')));
    assert.ok(!anotadas.includes(URL('llanta-1')), 'sigue en foto_url y en fotos');
  });

  test('una imagen que sigue en otro registro no cuenta como libre', async () => {
    const [a, b] = (await e.db.query('SELECT id FROM usuario ORDER BY id LIMIT 2')).rows;
    await e.db.query('UPDATE usuario SET foto_url = $1 WHERE id IN ($2, $3)', [URL('compartida'), a.id, b.id]);
    await e.db.query('UPDATE usuario SET foto_url = NULL WHERE id = $1', [a.id]);
    const { rows } = await e.db.query('SELECT imagen_en_uso($1) AS uso', [URL('compartida')]);
    assert.equal(rows[0].uso, true);
    assert.ok((await porBorrar()).includes(URL('compartida')), 'queda anotada, pero no se borra mientras se use');
  });

  test('si la transacción falla no se anota nada', async () => {
    const { id } = (await e.db.query('SELECT id FROM usuario ORDER BY id LIMIT 1')).rows[0];
    await e.db.query('UPDATE usuario SET foto_url = $1 WHERE id = $2', [URL('revertida'), id]);
    await e.db.query('BEGIN');
    await e.db.query('UPDATE usuario SET foto_url = NULL WHERE id = $1', [id]);
    await e.db.query('ROLLBACK');
    assert.ok(!(await porBorrar()).includes(URL('revertida')));
  });
});
