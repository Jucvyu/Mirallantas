# MiraLlantas ERP

Sistema de gestión para un negocio de venta de llantas y reencauche (proyecto SENA · ADSO).
Tiene un **panel administrativo** (catálogo, contactos, cotizaciones, ventas, compras, cartera)
y un **portal de clientes** (catálogo, cotizaciones, cartera y abonos), con modo claro y oscuro.

Es un **monorepo**: tres partes en carpetas separadas, cada una con su propio `package.json`
(y su `package-lock.json`), que se instalan y se despliegan por separado:

| Parte | Carpeta | Qué hace | Se despliega en |
| --- | --- | --- | --- |
| **Frontend** | `frontend/` | La interfaz web en React. No guarda datos: todo lo pide a la API. | Vercel |
| **Backend (API)** | `backend/` | API REST en Express que valida las reglas del negocio y guarda en PostgreSQL. | Render, Railway… |
| **Base de datos** | `database/` | Migraciones SQL y scripts de PostgreSQL (local, administrador, respaldos). | Neon, Render, Supabase… |

El `package.json` de la raíz no instala nada: solo trae atajos (`npm run dev`, `npm run api`,
`npm run db`…) que llaman al comando de cada carpeta.

---

## Tecnologías

### Frontend

| Tecnología | Versión | Para qué se usa |
| --- | --- | --- |
| [React](https://react.dev) | 19 | Librería de la interfaz (componentes y estado). |
| [Vite](https://vite.dev) | 8 | Servidor de desarrollo y empaquetado para producción. |
| [React Router](https://reactrouter.com) | 7 | Rutas y navegación (`/admin`, `/portal`, `/login`…). |
| [Tailwind CSS](https://tailwindcss.com) | 3 | Estilos con clases utilitarias; modo oscuro con `darkMode: 'class'`. |
| PostCSS + Autoprefixer | 8 / 10 | Procesan el CSS de Tailwind para los navegadores. |
| [Recharts](https://recharts.org) | 3 | Gráficas del dashboard. |
| [lucide-react](https://lucide.dev) | 1 | Iconos de la interfaz. |
| react-icons | 5 | Logos de redes sociales del pie de página. |
| `fetch` (nativo del navegador) | — | Peticiones HTTP a la API (ver `src/api/cliente.js`). |
| [oxlint](https://oxc.rs) | 1 | Revisión estática del código (`npm run lint`). |

### Backend

| Tecnología | Versión | Para qué se usa |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 o superior | Entorno de ejecución. Lee el `.env` con `--env-file` (sin librerías extra). |
| [Express](https://expressjs.com) | 5 | Servidor HTTP y rutas de la API. Atrapa por sí solo los errores de las funciones `async`. |
| [PostgreSQL](https://www.postgresql.org) | 16 o superior (local: 18) | Base de datos relacional. |
| [pg](https://node-postgres.com) (node-postgres) | 8 | Conexión a PostgreSQL y consultas con parámetros (`$1`, `$2`…). |
| [Zod](https://zod.dev) | 4 | Validación de los datos que llegan en cada petición. |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 3 | Guarda las contraseñas cifradas (hash), nunca en texto plano. |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | 9 | Tokens de sesión (JWT) que el frontend envía en cada petición. |
| [helmet](https://helmetjs.github.io) | 8 | Cabeceras HTTP de seguridad. |
| [cors](https://github.com/expressjs/cors) | 2 | Permite que solo el frontend autorizado llame a la API. |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | 8 | Limita las solicitudes por IP y los intentos de inicio de sesión (contra fuerza bruta). |
| [cloudinary](https://cloudinary.com/documentation/node_integration) | 2 | Guarda las imágenes subidas (fotos y comprobantes) fuera de la base. |
| [nodemailer](https://nodemailer.com) | 10 | Envía por correo (SMTP) el código para recuperar la contraseña. |
| `node:crypto` (nativo de Node) | — | Doble factor TOTP y cifrado AES-256-GCM de datos sensibles, sin librerías extra. |
| [embedded-postgres](https://github.com/leinelissen/embedded-postgres) | 18.4 (dev) | **Solo desarrollo y pruebas**: un PostgreSQL real sin instalar nada. |
| `node:test` (nativo de Node) | — | Pruebas automatizadas de la API. |

Las migraciones de la base de datos son archivos `.sql` normales que ejecuta un script propio
(`database/migrate.js`), sin librerías adicionales.

---

## Qué instalar en tu computador

El proyecto no necesita ningún SDK (ni Java, ni .NET, ni Android, ni Python). Solo:

| Programa | Para qué | Obligatorio |
| --- | --- | --- |
| [Node.js 22 LTS](https://nodejs.org) (trae `npm`) | Ejecutar el frontend, la API y la base de datos de desarrollo | **Sí** |
| [Git](https://git-scm.com) | Descargar y subir el código | **Sí** |
| [DBeaver Community](https://dbeaver.io) o [pgAdmin 4](https://www.pgadmin.org) | Ver y consultar la base de datos con una interfaz gráfica | No (recomendado) |
| Un editor (por ejemplo [VS Code](https://code.visualstudio.com)) | Editar el código | No |

No hace falta instalar PostgreSQL: el comando `npm run db` descarga (vía npm) y enciende un
PostgreSQL real solo para desarrollo. Si ya tienes PostgreSQL instalado, también puedes usarlo.

---

## Cómo correrlo en tu computador

### 1. Configuración (una sola vez)

```bash
npm run instalar
cp backend/.env.example backend/.env
```

`npm run instalar` instala las tres carpetas (`frontend/`, `backend/` y `database/`) con las
versiones exactas de sus `package-lock.json`. Los scripts de `database/` leen la misma
`backend/.env` (o `database/.env` si quieres apuntar a otra base).

Abre `backend/.env` y completa:

- `JWT_SECRET`: una clave larga y aleatoria. Genérala con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- `CLAVE_CIFRADO`: otra clave generada igual, **distinta** de `JWT_SECRET` (cifra los secretos
  del doble factor dentro de la base).
- `CLOUDINARY_URL` (opcional en desarrollo): sin ella las imágenes se guardan dentro de la base.
- `SMTP_*` y `CORREO_REMITENTE` (opcionales en desarrollo): sin ellos, el código de "¿Olvidaste tu
  contraseña?" no se envía por correo: aparece en la terminal de la API.

### 2. Base de datos: un solo comando

```bash
npm run db
```

Enciende PostgreSQL (la primera vez crea el clúster y la base), **aplica solas las migraciones
pendientes** (nunca borra datos) y queda escuchando; Ctrl+C lo detiene. Si todavía no hay
ningún Administrador, te muestra el comando para crearlo. La primera vez, en otra terminal:

```bash
npm run admin:crear -- --nombre "Tu Nombre" --correo tu@correo.com --documento 1020304050
```

`admin:crear` muestra **una sola vez** una contraseña temporal. Al entrar, cámbiala en **Mi perfil**
y, de forma recomendada, activa ahí la verificación en dos pasos (Google Authenticator,
Microsoft Authenticator o Authy).

El sistema no trae datos de ejemplo: clientes, productos, etc. se crean desde el panel. El único
servicio, **"Reencauche"**, lo crea la migración.

### 3. Día a día: tres terminales

| Terminal | Comando | Queda en |
| --- | --- | --- |
| 1. Base de datos | `npm run db` | `localhost:5433` |
| 2. API | `npm run api` | http://localhost:3000/api |
| 3. Frontend | `npm run dev` | http://localhost:5173 |

Para comprobar que la API responde: http://localhost:3000/api/salud → `{"estado":"ok"}`.

**¿Ya tienes PostgreSQL instalado?** No uses `npm run db`: crea una base, pon su dirección en
`DATABASE_URL` dentro de `backend/.env` y aplica las migraciones con `npm run migrate`.

**¿Quieres empezar la base desde cero?** Detén `npm run db`, borra la carpeta `database/.pgdata`
y repite el paso 2.

### Otros comandos

| Comando | Qué hace |
| --- | --- |
Todos se ejecutan desde la raíz:

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Compila el frontend para producción (carpeta `frontend/dist/`). |
| `npm run lint` | Revisa el código de las tres carpetas con oxlint. |
| `npm test` | Pruebas de la API contra un PostgreSQL temporal (se crea y se borra solo). |
| `npm run migrate` | Aplica las migraciones pendientes (lo hace solo `npm run db`; úsalo con otra base). |
| `npm run migrate:status` | Muestra qué migraciones están aplicadas. |
| `npm run migrate:down` | Revierte la última migración (borra datos: solo en desarrollo). |
| `npm run admin:crear -- …` | Crea el primer Administrador (solo si no hay ninguno activo). |
| `npm run db:respaldo` | Copia de seguridad completa en `database/respaldos/` (JSON). |
| `npm run db:restaurar -- respaldos/archivo.json` | Restaura una copia (ruta dentro de `database/`) en una base **nueva y vacía** (ya migrada). |
| `npm run db:limpiar -- --confirmar` | Borra todos los datos de negocio y deja solo al Administrador. ⚠ Saca antes un respaldo. |

Dentro de cada carpeta también funcionan sus propios comandos (por ejemplo `cd database` y
`npm run migrate`).

**Copias de seguridad:** los archivos de `database/respaldos/` tienen datos personales y hashes de
contraseñas. Están en `.gitignore`; guárdalos cifrados y fuera del repositorio. Las pruebas
automáticas comprueban que un respaldo se restaura completo en una base nueva.

---

## Ver la base de datos

Con `npm run db` encendido, conéctate desde DBeaver o pgAdmin con los
datos de `DATABASE_URL` (en `backend/.env`):

| Campo | Valor (desarrollo) |
| --- | --- |
| Host | `localhost` |
| Puerto | `5433` |
| Base de datos | `mirallantas` |
| Usuario | `mirallantas` |
| Contraseña | `mirallantas` |

En DBeaver: **Nueva conexión → PostgreSQL**, llena esos campos y pulsa *Probar conexión* (la
primera vez te pide descargar el controlador; acepta). Las tablas están en
`mirallantas → Esquemas → public → Tablas`. La tabla `schema_migrations` muestra qué migraciones
se aplicaron.

---

## Arquitectura

```
 FRONTEND (React · SOA)                         BACKEND (Express · MVC)                  BASE DE DATOS
 Pantallas → servicios → http.js  ── HTTP ──▶  rutas → controladores → modelos  ── SQL ──▶  PostgreSQL
            ◀─ datos listos ─────  ◀── JSON ──  vistas ◀───────────────────────
```

### Backend: Modelo-Vista-Controlador (MVC)

Cada módulo de la API (cotizaciones, ventas, cartera…) está repartido en cinco archivos con el
mismo nombre, uno por capa:

| Capa | Carpeta | Qué hace | Ejemplo |
| --- | --- | --- | --- |
| **Ruta** | `backend/src/routes/` | Une cada URL con sus middlewares y su controlador. | `cotizaciones.routes.js` |
| **Validación** | `backend/src/validators/` | Esquemas Zod: qué datos se aceptan y con qué reglas. | `cotizaciones.validator.js` |
| **Controlador** | `backend/src/controllers/` | Lee la petición, aplica las reglas del negocio y coordina. | `cotizaciones.controller.js` |
| **Modelo** | `backend/src/models/` | Solo SQL: leer y escribir en PostgreSQL. | `cotizaciones.model.js` |
| **Vista** | `backend/src/views/` | Arma la respuesta JSON y decide qué campos ve cada quien. | `documentos.view.js` |

Recorrido de una petición, por ejemplo `PATCH /api/cotizaciones/PED-2026-001`:

1. **Ruta** (`cotizaciones.routes.js`): exige sesión, permiso y que sea personal; valida el cuerpo.
2. **Controlador** (`cotizaciones.controller.js`): abre una transacción, revisa el flujo de estados
   con `reglas.js` y, si pasa a "Completada", genera la venta.
3. **Modelo** (`cotizaciones.model.js`, `ventas.model.js`): ejecuta los `SELECT` / `UPDATE` / `INSERT`.
4. **Vista** (`documentos.view.js`): responde `{ datos: … }` y oculta el proveedor a los clientes.

Piezas compartidas del backend:

| Archivo | Qué hace |
| --- | --- |
| `backend/src/app.js` | Arma la aplicación Express y monta todas las rutas. |
| `backend/src/reglas.js` | **Reglas del negocio** en un solo lugar: interés por plazo, cuota inicial del 50 %, cupo, flujos de estados. |
| `backend/src/middleware/auth.js` | Verifica el token, carga los permisos y limita al portal a sus propios datos. |
| `backend/src/middleware/validar.js` | Aplica un esquema de `validators/` a la petición. |
| `backend/src/models/listado.model.js` | Consultas comunes: listados paginados, búsqueda por número, `UPDATE` parcial. |
| `backend/src/views/respuesta.view.js` | Formato común de las respuestas (`datos`, `total`, `pagina`…). |
| `backend/src/errores.js` | Convierte cualquier error en una respuesta clara para el usuario. |
| `database/migrations/*.sql` | Esquema de la base de datos, versionado (`.up.sql` aplica, `.down.sql` revierte). |
| `database/crearAdmin.js`, `respaldo.js`, `limpiar.js` | Primer Administrador, copias de seguridad y limpieza de la base. |
| `backend/src/utils/` | Doble factor (TOTP), cifrado, contraseñas e imágenes (validación + Cloudinary). |
| `backend/test/fixtures/` | Datos de prueba: solo los usan las pruebas automáticas. |

### Frontend: orientado a servicios (SOA)

Las pantallas **no conocen la API**: le piden lo que necesitan a un servicio. Cada servicio sabe a
qué URL llamar, cómo enviar los datos del formulario y cómo convertir la respuesta al formato de
la pantalla.

| Servicio (`src/services/`) | Qué ofrece |
| --- | --- |
| `auth.service.js` | Iniciar y cerrar sesión, registrarse, perfil propio. |
| `empresa.service.js` | Datos de la empresa para los comprobantes. |
| `seguridad.service.js` | Roles, permisos y usuarios. |
| `catalogos.service.js` | Categorías, marcas, tipos de vehículo, servicios y productos. |
| `contactos.service.js` | Clientes, proveedores y terceros. |
| `operacion.service.js` | Cotizaciones (desde el panel o el portal), ventas y compras. |
| `cartera.service.js` | Créditos, abonos, solicitudes de crédito y de servicio. |
| `tableros.service.js` | Dashboard y resumen del portal. |
| `recurso.js` | Fábrica: `listar`, `obtener`, `crear`, `editar`, `eliminar` para cualquier ruta. |
| `http.js` | Único lugar que hace `fetch`: agrega el token y traduce los errores. |
| `adaptadores.js` | Conversiones API ↔ pantalla (`activo: true` ↔ `'Activo'`, `1968000` ↔ `'$ 1.968.000'`). |
| `index.js` | Punto de entrada: `import { clientesService } from '../../services'`. |

Cómo lo usa una pantalla:

```jsx
const clientes = useRecurso(clientesService);   // carga el listado
<DataTable data={clientes.filas} onCreate={clientes.crear} … />
```

Otras piezas del frontend:

| Archivo | Qué hace |
| --- | --- |
| `src/hooks/useRecurso.js` | Conecta una pantalla con un servicio: carga, crea, edita, elimina y recarga. |
| `src/hooks/useEnvio.js` | Envío de formularios a medida: evita el doble envío y muestra el error de la API. |
| `src/context/AuthContext.jsx` | Reparte el usuario en sesión y sus permisos (usa `authService`). |
| `src/context/PortalContext.jsx` | Reparte los datos del cliente en sesión (usa `portalService`). |
| `src/components/base/RutaProtegida.jsx` | Manda al login si no hay sesión y bloquea los módulos sin permiso. |
| `src/components/base/DataTable` | Tabla genérica: búsqueda, filtros, paginación y acciones. |
| `src/constantes.js` | Estados, flujos y reglas (copia de `backend/src/reglas.js`) y las listas que se llenan desde la base al abrir la app. |
| `src/utils/validaciones.js` + `src/hooks/useValidacion.js` | Validación en tiempo real de los formularios. |
| `src/components/base/RecorteCircular.jsx` | Recorte circular de la foto de perfil (arrastrar el círculo). |

### Seguridad

| Amenaza | Cómo se protege |
| --- | --- |
| Robo de contraseña | Contraseñas con bcrypt (costo 12), mínimo 10 caracteres con letras y números. **Doble factor (TOTP)** opcional desde "Mi perfil" (con `EXIGIR_2FA_ADMIN=true` se vuelve obligatorio para el Administrador). |
| Fuerza bruta | 10 intentos por IP cada 15 min y **bloqueo de la cuenta 15 min tras 5 fallos**. Límite general de 300 solicitudes por minuto por IP. |
| Sesiones robadas o abandonadas | Token de máximo 8 h; **cierre automático tras 30 min sin actividad**; al cerrar sesión, cambiar la contraseña o activar el doble factor, la API invalida todos los tokens anteriores. |
| Escalada de privilegios | Roles y Usuarios son **solo para el rol Administrador**. El rol Administrador no se edita ni se elimina (lo impide la API y un trigger de la base) y siempre queda al menos un Administrador activo. |
| Recuperar contraseña | El correo recibe un código de 6 dígitos (se guarda solo su huella HMAC) que vence en 10 min. 5 intentos por IP para escribir un correo registrado y 3 para el código; al agotarlos, la IP espera 2 minutos (lo cuenta la API, recargar no lo reinicia). Al cambiarla se cierran todas las sesiones. ⚠ Decir si un correo existe permite averiguar qué correos están registrados; los intentos limitados lo frenan. |
| Acciones sensibles | Cambiar contraseña o correo pide la contraseña actual; desactivar el doble factor pide contraseña y código. |
| Datos de otros clientes | Una cuenta del portal solo ve sus cotizaciones, créditos y abonos (404 si pide uno ajeno). |
| Inyección SQL | Todas las consultas usan parámetros (`$1`, `$2`…); los nombres de tablas y columnas salen del código, nunca de la petición. Hay pruebas que lo verifican. |
| Archivos maliciosos | Solo PNG, JPG o WEBP de máximo 3 MB, revisando los **bytes reales** del archivo (no la extensión). SVG rechazado. Se suben a Cloudinary con nombre aleatorio. |
| Accesos internos (SSRF) | La API nunca descarga direcciones que envíe el usuario; solo acepta imágenes como datos o de su propia cuenta de Cloudinary. |
| Pagos duplicados | Cada abono y cotización lleva una **clave de idempotencia** (`Idempotency-Key`): un doble clic o un reintento devuelve el mismo registro. |
| Código malicioso (XSS) | React escapa todo el texto; la API responde con `Content-Security-Policy: default-src 'none'` y el sitio con la CSP de `vercel.json`. |
| Secretos expuestos | Solo en variables de entorno (`.env` está en `.gitignore`). El secreto del doble factor se guarda **cifrado** (AES-256-GCM) con `CLAVE_CIFRADO`. |
| Accesos sospechosos | **Bitácora de seguridad** en la tabla `evento_seguridad` (se consulta desde DBeaver/pgAdmin): inicios de sesión, fallos, bloqueos, accesos sin permiso y **accesos del personal desde una IP nueva** (gravedad Alta). |
| Cuentas inactivas | Si el usuario, su rol o su ficha de cliente están inactivos, no puede entrar: tras escribir bien la contraseña ve la pantalla "Tu cuenta está inactiva". Si lo desactivan con la sesión abierta, sale a esa pantalla en su siguiente acción. |
| Base de datos | Conexión con SSL verificado (`DATABASE_SSL=true`), consultas cortadas a los 15 s, respaldos probados. |
| Webhooks | El sistema **no recibe webhooks** ni procesa pagos en línea: no hay nada expuesto que verificar. Si se integra una pasarela de pago, sus webhooks deben verificar la firma del proveedor. |

Estados: un registro **Inactivo** (cliente, proveedor, producto, categoría, marca, servicio, crédito)
se conserva con su historial pero no se usa en registros nuevos; la API lo rechaza con un mensaje
claro y los selectores del frontend solo muestran los activos. Los estados de documentos
(cotización, venta, compra, entrega, servicio, abono, solicitud) siguen los flujos de `reglas.js`.

Listas del sistema: tipos de documento, métodos de pago, medios de pago y tipos de vehículo viven en
la base (tablas `tipo_documento`, `metodo_pago`, `medio_pago`, `tipo_vehiculo`, migración 0005). Los
plazos de crédito (30/60/90) y su interés siguen en `reglas.js` porque son reglas de cálculo.

Reglas del negocio: el frontend calcula una vista previa mientras el usuario escribe, pero la API
**vuelve a calcular y validar todo** antes de guardar (precios, interés, cuota inicial, cupo, un
solo crédito abierto, flujos de estados).

---

## API REST

Todas las rutas empiezan por `/api`. Salvo `salud`, `auth/login`, `auth/2fa/verificar`, `auth/registro` y
`auth/recuperar/*`, exigen sesión.

| Módulo | Rutas | Permiso |
| --- | --- | --- |
| Sesión | `POST /auth/login`, `POST /auth/2fa/verificar`, `POST /auth/registro`, `POST /auth/salir`, `GET/PUT /auth/yo` | — |
| Recuperar contraseña | `GET /auth/recuperar/estado`, `POST /auth/recuperar/solicitar`, `/verificar`, `/cambiar` | pública |
| Doble factor | `POST /auth/2fa/configurar`, `/auth/2fa/activar`, `/auth/2fa/desactivar` | sesión |
| Empresa | `GET /empresa` (datos de los comprobantes; se registran directamente en la tabla `empresa`) | sesión |
| Listas del sistema | `GET /referencias` (tipos de documento, métodos y medios de pago) | pública |
| Roles | `GET/POST /roles`, `PUT/DELETE /roles/:id`, `GET /roles/permisos` | `Roles` + rol Administrador |
| Usuarios | `GET/POST /usuarios`, `PUT/DELETE /usuarios/:id` | `Usuarios` + rol Administrador |
| Catálogos | `GET/POST /categorias`, `/marcas`, `/tipos-vehiculo`, `/servicios` · `PUT/DELETE /…/:id` · `PATCH /…/:id/estado` | `Categorías`, `Marcas`, `Productos` |
| Productos | `GET/POST /productos`, `GET/PUT /productos/:id` | `Productos` para escribir |
| Contactos | `/clientes`, `/proveedores`, `/terceros` (mismas rutas que los catálogos) | `Clientes`, `Proveedores`, `Terceros` |
| Cotizaciones | `GET/POST /cotizaciones` (acepta `Idempotency-Key`), `GET/PATCH/DELETE /cotizaciones/:numero` | `Pedidos-Cotización` |
| Ventas | `GET/POST /ventas`, `GET/PATCH /ventas/:numero` | `Ventas` |
| Compras | `GET/POST /compras`, `GET/PATCH /compras/:numero` | `Compras` |
| Créditos | `GET/POST /creditos`, `GET/PATCH /creditos/:numero`, `POST /creditos/:numero/abonos` (acepta `Idempotency-Key`) | `Cartera` |
| Abonos | `GET /abonos`, `PATCH /abonos/:numero` (confirmar o rechazar) | `Abonos` |
| Solicitudes | `/solicitudes-credito`, `/solicitudes-servicio` | `Cartera`, `Solicitudes de servicio` |
| Tableros | `GET /dashboard`, `GET /portal/resumen` | `Dashboard` / sesión |
| Portal | `POST /portal/servicios/:numero/pago`, `GET /portal/notificaciones`, `POST /portal/notificaciones/leidas` | cliente |
| Avisos del personal | `GET /notificaciones`, `POST /notificaciones/leidas` | personal (solo los módulos que tenga, hoy Pedidos-Cotización) |
| Pago de servicios | `POST /solicitudes-servicio/:numero/pago` (aprobar o rechazar) | `Solicitudes de servicio` |

Los listados aceptan `?q=` (búsqueda), `?pagina=` y `?porPagina=` (máximo 100). Los errores
responden con `{ "error": "mensaje para el usuario", "detalles": [...] }` y un código HTTP
(401 sin sesión, 403 sin permiso, 404 no existe, 409 duplicado, 422 regla del negocio, 429
demasiados intentos). Un Administrador sin doble factor recibe 403 con `"codigo": "2FA_REQUERIDO"`.

---

## Reglas del negocio que aplica la API

- **Crédito**: interés de 3 %, 6 % o 9 % según el plazo (30, 60 o 90 días); la primera cuota
  debe cubrir al menos el **50 %** del total; cupo máximo de **$ 2.000.000** por cliente.
- **Un solo crédito abierto por cliente**: lo garantiza la base de datos con un índice único.
- **Total de la cotización**: precio del catálogo × cantidad (más el interés si es a crédito). Lo
  calcula la API; nadie lo escribe a mano.
- **Cotización a crédito**: exige registrar antes la cuota inicial (con comprobante, salvo pago en
  efectivo) y crea una **solicitud de crédito** pendiente por lo que se financia. En "Solicitudes
  de crédito" el asesor ve el detalle del pedido y la consignación y la aprueba o no:
  - **Aprobada**: se abre el crédito en la cartera del cliente (la cuota inicial queda como su
    primer abono confirmado) y la cotización pasa a "Aprobada". El saldo usable baja en lo que
    queda debiendo.
  - **No aprobada** (con motivo): la cotización se rechaza y sus llantas vuelven al stock.
- **Estado de pago**: cada cotización muestra su pago como Pendiente, Aprobado o Rechazado (de
  contado, la última consignación; a crédito, la solicitud que revisa la cuota inicial). En
  Pedidos-Cotización hay un filtro "Estado de pago" y, en "Mis cotizaciones", la carta de un pago
  rechazado se ve con contorno rojo. Todas las cartas tienen las mismas filas, así que quedan del
  mismo alto y ancho.
- **Servicios en el valor de la cotización**: el valor que el asesor le asigna a cada servicio
  de reencauche se suma al total de la cotización (en el portal y en el panel; el detalle muestra
  "productos + servicios"). Se siguen pagando aparte y la venta registra solo los productos.
- **Cotización frenada hasta que todo esté pagado**: el estado de pago incluye la consignación
  (o la cuota inicial) y cada servicio. Mientras falte algo, la cotización sigue en "Pendiente"
  (solo se puede rechazar). Cuando se aprueba el último pago queda en "Pendiente" con el pago
  "Aprobado" y el personal de Pedidos-Cotización recibe el aviso "Pago completo".
- **Créditos pagados**: un crédito con saldo en cero ya no ofrece "Registrar abono" (ni en el
  portal ni en el panel), y la API lo rechaza igual.
- **Vista de cliente por permisos**: "Catálogo (portal)", "Mis cotizaciones" y "Mi cartera" son
  permisos (grupo "Vista de cliente" en Roles). El botón "Portal del cliente" del panel solo
  aparece si el rol tiene alguno. Al iniciar sesión, el personal entra a su primer módulo del
  panel; solo se vuelve a la página anterior si el nuevo usuario tiene permiso para ella.
- **Avisos del personal**: la campana del panel avisa las cotizaciones nuevas del portal y los
  pagos vueltos a subir. Solo la ve quien tiene el módulo Pedidos-Cotización.
- **Pago de contado**: al crear una cotización de contado (con productos) se elige el medio
  (efectivo, transferencia, tarjeta u otro) y se sube la consignación (salvo en efectivo). Queda
  "pendiente de confirmación" (fila amarilla en Pedidos-Cotización) y la cotización no cambia de
  estado hasta que el asesor la aprueba o la desaprueba con motivo. Desaprobada, la fila se ve
  atenuada y el cliente recibe el aviso para volver a subir el pago; todas las consignaciones
  quedan en "Desplegar historial de pagos" del detalle (la más nueva primero).
- **Un solo servicio**: "Reencauche". En "Solicitudes de servicio" las solicitudes de una misma
  cotización se agrupan en una fila; al desplegarla aparecen en tarjetas donde se asigna el valor,
  se revisa el pago y se avanza el estado.
- **Cuentas**: el correo, el número de documento y el teléfono no se repiten entre cuentas. El
  mensaje es genérico ("No pudimos crear tu usuario") para no revelar qué dato ya existe. El
  administrador principal (el primero que se creó) no se desactiva, no cambia de rol ni se
  elimina; los demás se activan o desactivan desde la tabla de Usuarios, y una cuenta inactiva
  no entra (se le pide hablar con el administrador).
- **Servicios de reencauche**: se cobran aparte de la cotización (entran con valor $ 0). En
  "Solicitudes de servicio" el asesor le pone valor y el cliente recibe una notificación; el
  cliente lo paga desde "Mis cotizaciones" (con comprobante, salvo efectivo) y el pago queda
  "En revisión"; el asesor lo aprueba o lo rechaza con motivo. Rechazado, el servicio se ve en
  rojo y el cliente vuelve a subir el comprobante. El reencauche solo avanza de "Pendiente" con
  el pago aprobado, y su valor ya no cambia después de pagado.
- **Notificaciones**: el cliente las ve en la campana del portal (valor de un servicio, pagos y
  abonos aprobados o rechazados, crédito aprobado o no). Se revisan cada minuto.
- **Inventario**: una cotización descuenta el stock al crearse (si no alcanza, no se crea); si se
  rechaza, se elimina o su venta se anula, las unidades vuelven. Una compra suma su mercancía
  (y guarda el último precio de compra) al quedar **Recibida** y con entrega **Entregado**, una
  sola vez.
- **Al completar una cotización** se genera su venta con las mismas líneas (y su crédito, si lo
  tiene, queda ligado a esa venta).
- **Abonos**: nacen pendientes; cuando un asesor los confirma baja el saldo del crédito y sube el
  saldo usable del cliente. Si los rechaza (con motivo), el cliente lo ve en rojo en "Mi cartera"
  y vuelve a subir el abono.
- **Estados**: cada documento solo avanza por las transiciones permitidas (`FLUJOS` en `reglas.js`).
- **Numeración**: consecutivos por tipo y año (`PED-2026-001`, `VEN-2026-001`…), seguros aunque
  se creen varios documentos a la vez.

---

## Estructura de carpetas

```
├── package.json                   ← solo atajos que llaman a cada carpeta
│
├── database/                      ← Base de datos (PostgreSQL)
│   ├── migrations/                  (esquema SQL versionado)
│   ├── migrate.js                   (aplica / revierte migraciones)
│   ├── crearAdmin.js                (primer Administrador)
│   ├── respaldo.js, limpiar.js      (copias de seguridad y limpieza)
│   ├── local.js                     (PostgreSQL local para desarrollo)
│   ├── .pgdata/, respaldos/         (datos locales y copias: fuera de git)
│   └── package.json
│
├── backend/                       ← API (Express + PostgreSQL) · arquitectura MVC
│   ├── src/
│   │   ├── routes/                  (URL → middlewares → controlador)
│   │   ├── validators/              (esquemas Zod de cada módulo)
│   │   ├── controllers/             (reglas del negocio y coordinación)
│   │   ├── models/                  (consultas SQL)
│   │   ├── views/                   (forma de las respuestas JSON)
│   │   ├── middleware/              (sesión, permisos, validación e idempotencia)
│   │   ├── utils/                   (doble factor, cifrado, contraseñas, imágenes)
│   │   ├── reglas.js, errores.js, db.js, config.js
│   │   └── app.js, server.js
│   ├── test/                        (pruebas: usan las migraciones de database/)
│   └── package.json
│
└── frontend/                      ← Frontend (React + Vite) · arquitectura SOA
    ├── src/
    │   ├── services/                (un servicio por dominio + http.js + adaptadores)
    │   ├── hooks/                   (useRecurso, useEnvio, useDetalle, useEmpresa)
    │   ├── context/                 (sesión, portal, crédito, carrito, tema)
    │   ├── components/
    │   │   ├── base/                (DataTable, FormModal, Modal, RutaProtegida…)
    │   │   └── layout/              (panel y portal)
    │   ├── features/                (una carpeta por pantalla)
    │   ├── constantes.js, permisos.js
    │   └── App.jsx                  (rutas)
    ├── public/, index.html
    ├── vite.config.js, tailwind.config.js, vercel.json
    └── package.json
```

Las rutas `src/…` de las tablas anteriores son del frontend (`frontend/src/…`).

---

## Paleta de marca

| Token (Tailwind) | Hex | Uso |
| --- | --- | --- |
| `amber.400` | `#FBBF24` | Acento principal: botones, KPIs, enlaces activos |
| `brand.navy.950` | `#0B0E13` | Sidebar, secciones oscuras, fondo del modo oscuro |
| `brand.navy.800` | `#161B24` | Tarjetas en modo oscuro |
| `brand.gold.500` | `#C9A876` | Dorado del pie de página |

Definidos en `frontend/tailwind.config.js` bajo `theme.extend.colors`.

---

## Despliegue

Se despliegan tres piezas, en este orden: **base de datos → API → frontend**. Cada una sale de
su carpeta del monorepo: en el proveedor se conecta el mismo repositorio y se indica la
**carpeta raíz** (`database/`, `backend/` o `frontend/`). Un ejemplo con servicios que tienen
plan gratuito (puedes usar otros equivalentes):

### 1. Base de datos (PostgreSQL administrado: Neon, Render o Supabase)

1. Crea una base PostgreSQL y copia su dirección de conexión (`postgres://usuario:clave@host/base`).
   **No la abras a internet**: deja que solo la API se conecte (en Render/Neon usa la dirección
   interna o la lista de IP permitidas) y activa las copias automáticas del proveedor.
2. Desde tu equipo (en la raíz del proyecto), aplica las migraciones de `database/` (crean
   las tablas, los roles y los permisos). La variable de la terminal tiene prioridad sobre los
   archivos `.env`:
   ```bash
   DATABASE_URL="postgres://…" npm run migrate
   ```
   En PowerShell: `$env:DATABASE_URL="postgres://…"; npm run migrate`. También puedes poner esa
   dirección en `database/.env` (copia de `database/.env.example`, fuera de git).
3. Crea el primer Administrador (anota la contraseña temporal que muestra):
   ```bash
   DATABASE_URL="postgres://…" npm run admin:crear -- --nombre "Nombre" --correo admin@tuempresa.com --documento 123456789
   ```
   Cada vez que haya migraciones nuevas, repite el paso 2 **antes** de desplegar la API.
4. Recomendado: que la API se conecte con un usuario de PostgreSQL que **no** sea el dueño de
   la base, con permisos solo de `SELECT, INSERT, UPDATE, DELETE` sobre las tablas.

### 2. API (Render, Railway o similar · servicio web de Node)

| Configuración | Valor |
| --- | --- |
| Carpeta raíz | `backend` |
| Comando de instalación | `npm ci --omit=dev` |
| Comando de inicio | `npm start` |

Variables de entorno (todas en el panel del proveedor, **nunca** en el código):

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | La de la base |
| `DATABASE_SSL` | `true` (verifica el certificado). Solo si el proveedor no lo permite: `no-verify` |
| `JWT_SECRET` | Nueva, larga y distinta a la de desarrollo |
| `CLAVE_CIFRADO` | Nueva, distinta de `JWT_SECRET`. Si se pierde, los usuarios deben reconfigurar el doble factor |
| `CLOUDINARY_URL` | Panel de Cloudinary → *API Keys* → `cloudinary://<api_key>:<api_secret>@<cloud_name>` (obligatoria) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CORREO_REMITENTE` | Servidor de correo para los códigos de recuperación (obligatorio). Con Gmail usa una *contraseña de aplicación* |
| `CORS_ORIGINS` | La dirección https del frontend, p. ej. `https://mirallantas.vercel.app` (sin `*`) |
| `EXIGIR_2FA_ADMIN` | `false` por ahora (doble factor opcional); `true` lo vuelve obligatorio para el Administrador |
| `APP_TIMEZONE` | `America/Bogota` |

La API se niega a arrancar en producción si falta alguna de estas o si `CORS_ORIGINS` no es https.
Comprueba `https://tu-api/api/salud` → `{"estado":"ok"}`.

### 3. Frontend (Vercel)

1. Conecta el repositorio en Vercel y en **Root Directory** elige `frontend` (Vercel detecta
   Vite y usa `frontend/vercel.json`).
2. En **Settings → Environment Variables** agrega `VITE_API_URL=https://tu-api/api`.
3. Vuelve a desplegar (las variables de Vite se leen al compilar).
4. `vercel.json` ya trae las cabeceras de seguridad (CSP, HSTS, anti-iframe). Cuando tengas la
   dirección definitiva de la API, cambia en la CSP `connect-src 'self' https:` por
   `connect-src 'self' https://tu-api` para que el sitio solo hable con tu API.
5. SEO: `index.html` trae título, descripción, Open Graph y datos estructurados; `robots.txt`
   deja indexar la página pública y bloquea `/admin`, `/portal` y `/login`. Con el dominio
   definitivo, agrega `<link rel="canonical">` y un `sitemap.xml`, y registra el sitio en
   Google Search Console.

### 4. Después de desplegar

1. Inicia sesión con el Administrador, cambia la contraseña y (recomendado) activa la verificación en dos pasos.
2. Registra los datos reales de la empresa en la tabla `empresa` (con DBeaver/pgAdmin) y crea el catálogo
   (el servicio "Reencauche" ya lo crea la migración).
3. Revisa cada semana la tabla `evento_seguridad` (eventos de gravedad `Alta`).
4. Si algo falla: en Vercel puedes volver al despliegue anterior con un clic (*Promote to
   Production*); en la API, redepliega la versión anterior. Antes de migrar la base, saca una
   copia de seguridad (los proveedores administrados la ofrecen).

---

## Pendiente de decisión

Estos puntos del plan de mejoras esperan una decisión del equipo antes de implementarse:

- Formato del código automático de productos (hoy el asesor lo escribe al crear).
- Vigencia de 8 días de las cotizaciones y PDF de cotización.
- Abono mínimo del 30 % en compras a crédito y acuerdos de precio con proveedores.
- Comprobante de venta en PDF (hoy se descarga en texto).
- Estados de cotización que permiten comprar (hoy: "Aprobada" y "En proceso").
- Recuperación de contraseña por correo (hoy la restablece un administrador).
