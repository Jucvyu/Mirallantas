import { crearApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { limpiarImagenes } from './utils/limpiezaImagenes.js';

const servidor = crearApp().listen(config.puerto, () => {
  console.log(`API de MiraLlantas escuchando en http://localhost:${config.puerto} (${config.entorno})`);
  // Lo que haya quedado pendiente de la última vez
  limpiarImagenes();
});

// Cierre ordenado: termina las peticiones en curso y libera las conexiones
const cerrar = () => {
  servidor.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
