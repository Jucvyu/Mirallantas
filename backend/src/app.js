import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { query } from './db.js';
import { HttpError, manejadorErrores } from './errores.js';
import { limpiarImagenes } from './utils/limpiezaImagenes.js';
import { avisarCambio, debeAvisar, recursoDe, suscribir } from './utils/tiempoReal.js';
import { autenticar } from './middleware/auth.js';
import { limitePeticiones } from './middleware/limitePeticiones.js';
// Cada módulo tiene sus rutas en src/routes/<modulo>.routes.js. Las rutas
// llaman a los controladores (src/controllers), que usan los modelos
// (src/models) para hablar con la base y las vistas (src/views) para
// responder: es el patrón Modelo-Vista-Controlador.
import { rutasAuth } from './routes/auth.routes.js';
import { rutasAbonos, rutasCreditos, rutasSolicitudesCredito } from './routes/cartera.routes.js';
import {
  rutasCategorias,
  rutasClientes,
  rutasMarcas,
  rutasProveedores,
  rutasServicios,
  rutasTerceros,
  rutasTiposVehiculo,
} from './routes/catalogos.routes.js';
import { rutasCompras } from './routes/compras.routes.js';
import { rutasCotizaciones } from './routes/cotizaciones.routes.js';
import { rutasDashboard } from './routes/dashboard.routes.js';
import { rutasEmpresa } from './routes/empresa.routes.js';
import { rutasCatalogo } from './routes/catalogo.routes.js';
import { rutasNotificaciones } from './routes/notificaciones.routes.js';
import { rutasPortal } from './routes/portal.routes.js';
import { rutasProductos } from './routes/productos.routes.js';
import { rutasReferencias } from './routes/referencias.routes.js';
import { rutasRoles, rutasUsuarios } from './routes/seguridad.routes.js';
import { rutasSolicitudesServicio } from './routes/solicitudesServicio.routes.js';
import { rutasVentas } from './routes/ventas.routes.js';

/** Construye la aplicación Express. Separada de server.js para las pruebas. */
export function crearApp() {
  const app = express();

  // Detrás de un proxy (Render, Railway…) la IP real llega en X-Forwarded-For
  if (config.esProduccion) app.set('trust proxy', 1);

  // Cabeceras de seguridad. La API solo responde JSON: no carga scripts,
  // estilos ni marcos, así que la política de contenido lo prohíbe todo.
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // Solo el frontend autorizado puede llamar a la API desde un navegador
  app.use(
    cors({
      origin: config.corsOrigenes,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      // El frontend puede leer cuántas fichas le quedan y cuánto esperar
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );

  // Límite general por usuario contra el abuso de la API: un cubo de 200
  // fichas que se recarga a 200 por minuto (ver middleware/limitePeticiones.js).
  // El login tiene uno más estricto por IP en auth.routes.js.
  if (config.limiteApi.activo) app.use('/api', limitePeticiones);

  // Las fotos y los comprobantes viajan dentro del JSON como imágenes en
  // texto (data URL), por eso el límite es mayor que el de 100 KB por defecto
  // (un reencauche lleva hasta 3 fotos de 3 MB, ~4 MB cada una en base64)
  // Respuestas comprimidas (gzip): los listados viajan mucho más livianos.
  // El canal de tiempo real no se comprime: así cada aviso llega al instante.
  app.use(
    compression({
      filter: (req, res) => req.path !== '/api/eventos' && compression.filter(req, res),
    }),
  );

  app.use(express.json({ limit: '20mb' }));

  // Las respuestas tienen datos privados: el navegador no debe guardarlas
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Después de un cambio que salió bien, borra de Cloudinary las imágenes
  // que quedaron sin usar (en segundo plano, no demora la respuesta)
  // y avisa a las pantallas abiertas para que se actualicen solas
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) limpiarImagenes();
        if (debeAvisar(req, res)) avisarCambio(recursoDe(req.originalUrl));
      });
    }
    next();
  });

  // Tiempo real: cada pantalla abierta escucha aquí los avisos de cambios
  app.get('/api/eventos', autenticar, suscribir);

  // Salud: la usa el proveedor de hosting para saber si la API responde
  app.get('/api/salud', async (req, res) => {
    await query('SELECT 1');
    res.json({ estado: 'ok' });
  });

  // ---- Sesión, configuración y seguridad ----
  app.use('/api/auth', rutasAuth);
  app.use('/api/referencias', rutasReferencias);
  app.use('/api/empresa', rutasEmpresa);
  app.use('/api/roles', rutasRoles);
  app.use('/api/usuarios', rutasUsuarios);
  app.use('/api/dashboard', rutasDashboard);
  app.use('/api/portal', rutasPortal);
  app.use('/api/notificaciones', rutasNotificaciones);

  // ---- Catálogo ----
  app.use('/api/categorias', rutasCategorias);
  app.use('/api/marcas', rutasMarcas);
  app.use('/api/tipos-vehiculo', rutasTiposVehiculo);
  app.use('/api/servicios', rutasServicios);
  app.use('/api/productos', rutasProductos);
  app.use('/api/catalogo', rutasCatalogo);

  // ---- Contactos ----
  app.use('/api/clientes', rutasClientes);
  app.use('/api/proveedores', rutasProveedores);
  app.use('/api/terceros', rutasTerceros);

  // ---- Operación y cartera ----
  app.use('/api/cotizaciones', rutasCotizaciones);
  app.use('/api/ventas', rutasVentas);
  app.use('/api/compras', rutasCompras);
  app.use('/api/solicitudes-servicio', rutasSolicitudesServicio);
  app.use('/api/creditos', rutasCreditos);
  app.use('/api/abonos', rutasAbonos);
  app.use('/api/solicitudes-credito', rutasSolicitudesCredito);

  app.use((req, res) => {
    throw new HttpError(404, `La ruta ${req.method} ${req.path} no existe.`);
  });
  app.use(manejadorErrores);

  return app;
}
