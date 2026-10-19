import { crearApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const servidor = crearApp().listen(config.puerto, () => {
  console.log(`API de MiraLlantas escuchando en http://localhost:${config.puerto} (${config.entorno})`);
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
