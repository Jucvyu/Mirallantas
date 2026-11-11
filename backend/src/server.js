import { crearApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { limpiarImagenes } from './utils/limpiezaImagenes.js';
import { cerrarConexiones } from './utils/tiempoReal.js';
import { vencerNoPagadas } from './controllers/reencauches.controller.js';

/** Cada cuánto se revisan las llantas reencauchadas que el cliente no pagó. */
const REVISAR_NO_PAGADAS_MS = 60 * 60 * 1000;
const revisarNoPagadas = () =>
  vencerNoPagadas().catch((e) => console.error('No se pudieron revisar las llantas sin pago:', e.message));

const servidor = crearApp().listen(config.puerto, () => {
  console.log(`API de MiraLlantas escuchando en http://localhost:${config.puerto} (${config.entorno})`);
  // Lo que haya quedado pendiente de la última vez
  limpiarImagenes();
  revisarNoPagadas();
});
setInterval(revisarNoPagadas, REVISAR_NO_PAGADAS_MS).unref();

// Cierre ordenado: termina las peticiones en curso y libera las conexiones
const cerrar = () => {
  // Las conexiones de tiempo real quedan abiertas: se cierran para no esperarlas
  cerrarConexiones();
  servidor.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
