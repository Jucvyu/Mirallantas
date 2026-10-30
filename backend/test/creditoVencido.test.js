import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { levantarEntorno } from './entorno.js';

// La configuración se lee al importar el modelo: hay que hacerlo después de
// que levantarEntorno fije las variables de entorno.
let creditosModel;

/**
 * Aviso de crédito vencido: cuando un crédito pasa su fecha límite con saldo,
 * se avisa una sola vez al cliente y al personal de cartera.
 */

let e;
const t = {};

before(async () => {
  e = await levantarEntorno();
  creditosModel = await import('../src/models/creditos.model.js');
  t.admin = await e.iniciarSesion('admin@mirallantas.com');
});

after(async () => {
  await e?.cerrar();
});

const contar = async (sql, params = []) => (await e.db.query(sql, params)).rows[0].n;

describe('Crédito vencido', () => {
  test('avisa al cliente y al personal, una sola vez', async () => {
    const credito = (
      await e.db.query('SELECT id, numero, cliente_id FROM credito WHERE iniciado AND saldo_pendiente > 0 LIMIT 1')
    ).rows[0];
    assert.ok(credito, 'hay un crédito iniciado con saldo en los datos de prueba');

    // Lo deja vencido y sin avisar; limpia avisos previos de ese cliente
    await e.db.query('UPDATE credito SET fecha_limite = CURRENT_DATE - 1, aviso_vencido_en = NULL WHERE id = $1', [
      credito.id,
    ]);
    await e.db.query("DELETE FROM notificacion WHERE cliente_id = $1 AND titulo = 'Crédito vencido'", [
      credito.cliente_id,
    ]);

    const avisados = await creditosModel.avisarVencidos();
    assert.ok(avisados >= 1, 'avisó al menos el crédito vencido');

    assert.equal(
      await contar('SELECT count(*)::int n FROM notificacion WHERE cliente_id = $1 AND titulo = $2', [
        credito.cliente_id,
        'Crédito vencido',
      ]),
      1,
      'el cliente recibe un aviso',
    );
    assert.ok(
      (await contar(
        "SELECT count(*)::int n FROM notificacion_personal WHERE modulo = 'Cartera' AND titulo = 'Crédito vencido'",
      )) >= 1,
      'el personal de cartera recibe el aviso',
    );

    // Una segunda pasada no vuelve a avisar ese crédito
    await creditosModel.avisarVencidos();
    assert.equal(
      await contar('SELECT count(*)::int n FROM notificacion WHERE cliente_id = $1 AND titulo = $2', [
        credito.cliente_id,
        'Crédito vencido',
      ]),
      1,
      'no se duplica el aviso',
    );
  });

  test('un crédito al día no genera aviso', async () => {
    const credito = (
      await e.db.query('SELECT id, cliente_id FROM credito WHERE iniciado AND saldo_pendiente > 0 LIMIT 1')
    ).rows[0];
    await e.db.query('UPDATE credito SET fecha_limite = CURRENT_DATE + 10, aviso_vencido_en = NULL WHERE id = $1', [
      credito.id,
    ]);
    await e.db.query("DELETE FROM notificacion WHERE cliente_id = $1 AND titulo = 'Crédito vencido'", [
      credito.cliente_id,
    ]);
    await creditosModel.avisarVencidos();
    assert.equal(
      await contar("SELECT count(*)::int n FROM notificacion WHERE cliente_id = $1 AND titulo = 'Crédito vencido'", [
        credito.cliente_id,
      ]),
      0,
      'un crédito vigente no genera aviso',
    );
  });

  test('GET /creditos responde bien (dispara el aviso en segundo plano)', async () => {
    const r = await e.api('/creditos', { token: t.admin });
    assert.equal(r.estado, 200);
  });
});
