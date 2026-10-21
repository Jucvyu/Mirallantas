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
| [Resend](https://resend.com) (API HTTP) | — | Envía el correo con el enlace para recuperar la contraseña (sin librería: `fetch` nativo de Node). |
| [PDFKit](https://pdfkit.org) | 0.20 | Genera en el servidor la cotización formal y el comprobante de venta en PDF. |
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
- `RESEND_API_KEY`, `CORREO_REMITENTE` y `FRONTEND_URL` (opcionales en desarrollo): sin clave de
  Resend, el enlace de "¿Olvidaste tu contraseña?" no se envía: aparece en la terminal de la API.

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
| `backend/src/reglas.js` | **Reglas del negocio** en un solo lugar: interés por plazo, cuota inicial del 30 %, vigencia de 8 días, medios de pago del portal, cupo, flujos de estados. |
| `backend/src/views/pdf.view.js` | Cotización formal y comprobante de venta en PDF, con los datos guardados. |
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
| Recuperar contraseña | Enlace de un solo uso enviado con Resend: token aleatorio de 256 bits (se guarda solo su huella HMAC), vence en 30 minutos y queda anulado al usarse o al pedir otro. La respuesta es la misma exista o no el correo (no revela cuentas). 5 solicitudes por IP; luego 15 minutos de espera. El token va en el fragmento `#` del enlace (no llega a servidores ni al "Referer") y no sirve como sesión. Al cambiar la contraseña se cierran todas las sesiones. Si Resend rechaza el envío, el enlace se anula y se registra el motivo (sin el token). |
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
| Recuperar contraseña | `POST /auth/recuperar/solicitar`, `/validar`, `/restablecer` | pública |
| Catálogo público | `GET /catalogo` (productos activos, sin precios) | pública |
| Doble factor | `POST /auth/2fa/configurar`, `/auth/2fa/activar`, `/auth/2fa/desactivar` | sesión |
| Empresa | `GET /empresa` (datos de los comprobantes; se registran directamente en la tabla `empresa`) | sesión |
| Listas del sistema | `GET /referencias` (tipos de documento, métodos y medios de pago) | pública |
| Roles | `GET/POST /roles`, `PUT/DELETE /roles/:id`, `GET /roles/permisos` | `Roles` + rol Administrador |
| Usuarios | `GET/POST /usuarios`, `PUT/DELETE /usuarios/:id` | `Usuarios` + rol Administrador |
| Catálogos | `GET/POST /categorias`, `/marcas`, `/tipos-vehiculo`, `/servicios` · `PUT/DELETE /…/:id` · `PATCH /…/:id/estado` | `Categorías`, `Marcas`, `Productos` |
| Productos | `GET/POST /productos`, `GET /productos/medidas`, `GET/PUT /productos/:id` | `Productos` para escribir |
| Contactos | `/clientes`, `/proveedores`, `/terceros` (mismas rutas que los catálogos) | `Clientes`, `Proveedores`, `Terceros` |
| Cotizaciones | `GET/POST /cotizaciones` (solicitud; acepta `Idempotency-Key`), `GET/PATCH/DELETE /cotizaciones/:numero`, `POST /cotizaciones/:numero/emitir`, `POST /cotizaciones/:numero/aceptar`, `GET /cotizaciones/:numero/pdf` | `Pedidos-Cotización` |
| Ventas | `GET/POST /ventas`, `GET/PATCH /ventas/:numero`, `GET /ventas/:numero/pdf` | `Ventas` |
| Compras | `GET/POST /compras`, `GET/PATCH /compras/:numero` | `Compras` |
| Créditos | `GET/POST /creditos`, `GET/PATCH /creditos/:numero`, `POST /creditos/:numero/abonos` (acepta `Idempotency-Key`) | `Cartera` |
| Abonos | `GET /abonos`, `PATCH /abonos/:numero` (confirmar o rechazar) | `Abonos` |
| Solicitudes | `/solicitudes-credito`, `/solicitudes-servicio` | `Cartera`, `Solicitudes de servicio` |
| Tableros | `GET /dashboard`, `GET /portal/resumen` | `Dashboard` / sesión |
| Portal | `POST /portal/cotizaciones/:numero/aceptar`, `POST /portal/servicios/:numero/pago`, `GET /portal/ventas/:numero/pdf`, `GET /portal/notificaciones`, `POST /portal/notificaciones/leidas` | cliente |
| Avisos del personal | `GET /notificaciones`, `POST /notificaciones/leidas` | personal (solo los módulos que tenga, hoy Pedidos-Cotización) |
| Pago de servicios | `POST /solicitudes-servicio/:numero/pago` (aprobar o rechazar) | `Solicitudes de servicio` |

Los listados aceptan `?q=` (búsqueda), `?pagina=` y `?porPagina=` (máximo 100). Los errores
responden con `{ "error": "mensaje para el usuario", "detalles": [...] }` y un código HTTP
(401 sin sesión, 403 sin permiso, 404 no existe, 409 duplicado, 422 regla del negocio, 429
demasiados intentos). Un Administrador sin doble factor recibe 403 con `"codigo": "2FA_REQUERIDO"`.

---

## Reglas del negocio que aplica la API

- **Flujo comercial de la cotización** (columna "Etapa"):
  1. **Solicitud**: el cliente arma su carro de cotización en el catálogo (llantas y cantidades,
     sin precios ni stock) y la envía; el asesor también puede registrarla. No lleva fecha manual
     (la pone el servidor), precios ni método de pago. El cliente ve el aviso de que los precios se
     confirman en **hasta 24 horas** y que enviarla no es una compra.
  2. **Cotización formal**: en Pedidos-Cotización, "Confirmar precios" registra por cada llanta el
     proveedor, el **costo que este confirmó** (con fecha y usuario; nunca se toma solo un costo
     viejo) y el **precio de venta** (no puede quedar por debajo del costo). Al emitirla vence a los
     **8 días calendario** (la fecha la calcula la base con la zona horaria del negocio). Si el
     catálogo cambia después, la cotización emitida conserva sus precios. Se descarga en **PDF**.
  3. **Aceptación**: dentro de la vigencia, el cliente elige **contado** (paga el 100 %) o
     **crédito** (cuota inicial de al menos el 30 %). Vencida, el asesor la vuelve a confirmar y
     emitir. Una solicitud o una cotización sin aceptar no avanza ni se despacha (solo se rechaza).
- **Crédito (ventas a crédito)**: interés de 3 %, 6 % o 9 % según el plazo (30, 60 o 90 días); la
  cuota inicial cubre al menos el **30 %** del total (redondeado hacia arriba al peso) y el resto se
  financia; de contado se paga el 100 %. Vale para la aceptación de cotizaciones y para las ventas
  directas. No aplica a las compras a proveedores. Cupo máximo de **$ 2.000.000** por cliente.
- **Medios de pago**: el cliente paga en efectivo o por transferencia desde el portal, y al
  **aceptar una cotización** (desde el portal o en el local) solo se admiten esos dos: tarjeta y
  "otro" quedaron fuera de ese flujo (la API lo exige). Los abonos del asesor conservan todos.
- **Catálogos y gestión de productos sin precios**: ni el catálogo del cliente, ni el público, ni la
  pantalla de Productos muestran precios, rangos, costos o stock (la API no los devuelve). Las
  columnas `precio_venta` y `precio_compra` siguen en la base para las operaciones comerciales: el
  precio de venta se define al emitir cada cotización y el de compra en cada compra.
- **Catálogo público**: el menú del landing tiene "Catálogo" (`/catalogo`), sin iniciar sesión;
  para cotizar se inicia sesión y se usa el carro del portal.
- **Solicitud por WhatsApp**: en "Mi carro de cotización", "Solicitar por WhatsApp" abre
  WhatsApp con un mensaje ya escrito (nombre del cliente, lugar de despacho y llantas/servicios
  con su cantidad; nunca precios ni stock). El cliente decide enviarlo desde WhatsApp: el sistema
  no lo da por enviado. El número es `VITE_WHATSAPP_NUMERO` (por defecto el que publica el sitio).
- **Lugar de despacho**: la nueva cotización (panel y portal) carga la dirección registrada del
  cliente y se puede cambiar solo para esa cotización; se guarda con ella y no modifica la ficha
  del cliente. Al cambiar de cliente se carga la dirección del nuevo.
- **Productos**: el código lo genera la base (**ML-000001**, …) con una secuencia y una restricción
  única; no cambia al editar. El formulario no pide precios ni stock; la medida, la categoría, la
  marca y el tipo de vehículo se eligen con buscador.
- **Buscadores de relaciones**: cliente, proveedor, tercero, rol, categoría, marca, tipo de
  vehículo, medida y factura se eligen con el mismo componente de búsqueda (`SearchSelect`), que
  guarda el id real del registro; la API valida que exista y esté activo.
- **Sin stock**: el aplicativo no maneja existencias (la migración 0010 retiró `producto.stock` y
  `compra.stock_aplicado`). Las cantidades de cotizaciones, ventas y compras se conservan. Recibir
  una compra solo guarda el último costo de compra de cada llanta (dato interno).
- **Un solo crédito abierto por cliente**: lo garantiza la base de datos con un índice único.
- **Total de la cotización**: precio confirmado × cantidad (más el interés si es a crédito). Lo
  calcula la API; nadie lo escribe a mano.
- **Aceptación a crédito**: exige la cuota inicial (con comprobante, salvo pago en efectivo) y crea
  una **solicitud de crédito** pendiente por lo que se financia. En "Solicitudes
  de crédito" el asesor ve el detalle del pedido y la consignación y la aprueba o no:
  - **Aprobada**: se abre el crédito en la cartera del cliente (la cuota inicial queda como su
    primer abono confirmado) y la cotización pasa a "Aprobada". El saldo usable baja en lo que
    queda debiendo.
  - **No aprobada** (con motivo): la cotización se rechaza.
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
- **Compras**: cada línea que viene de la cotización muestra si su costo se confirmó con el
  proveedor (y cuándo) o si está sin confirmar; el precio propuesto es ese costo confirmado.
- **Comprobante de venta en PDF**: se genera en el servidor con la venta guardada (empresa,
  cliente, llantas, cuota inicial y saldo si es a crédito). No es una factura electrónica.
- **Tablas del panel**: en pantalla grande caben sin scroll horizontal (el texto largo baja de
  línea); en celular y tableta cada fila se ve como una tarjeta con todas sus columnas.
- **Al completar una cotización** se genera su venta con las mismas líneas (y su crédito, si lo
  tiene, queda ligado a esa venta).
- **Abonos del cliente**: nacen pendientes; cuando un asesor los confirma baja el saldo del crédito
  y sube el saldo usable del cliente. Si los rechaza (con motivo), el cliente lo ve en rojo en "Mi
  cartera" y vuelve a subir el abono.
- **Nuevo abono del asesor (por factura)**: la factura es la **venta a crédito** (VEN-…), cuyo
  crédito guarda el saldo. Se busca el cliente y luego su factura (solo ventas no anuladas con
  crédito activo y saldo). En una sola transacción, con la factura bloqueada, se valida que el monto
  sea mayor que cero y no supere el saldo, se guarda el abono **confirmado** y se resta el saldo
  (si algo falla no queda ninguno). La clave de idempotencia evita duplicarlo por doble envío. Un
  crédito cuya cotización aún no se completa no tiene factura: ese abono lo sube el cliente.
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

Se despliegan tres piezas, en este orden: **base de datos → API → frontend**, más dos servicios
externos (Cloudinary para imágenes y Resend para el correo). Cada pieza sale de su carpeta del
monorepo. La configuración recomendada (la que usa el proyecto) es:

| Pieza | Servicio | Carpeta |
| --- | --- | --- |
| Base de datos | Supabase (PostgreSQL) | `database/` (se migra desde tu equipo) |
| API | Render (Web Service de Node) | `backend/` |
| Frontend | Vercel | `frontend/` |

### 1. Base de datos (Supabase)

1. Crea el proyecto y guarda la clave de la base. Usa una clave solo de letras y números.
2. **Connect → Session pooler**: copia la dirección (puerto 5432) y agrégale al final
   `?uselibpqcompat=true&sslmode=require` (Supabase usa su propia entidad certificadora; así la
   conexión va cifrada). No uses la conexión directa (solo IPv6) ni el "Transaction pooler".
3. **Project Settings → Data API**: desactívala. La app no la usa y, encendida, publica las tablas
   con la llave pública de Supabase.
4. Desde tu equipo, en la raíz del proyecto, aplica las migraciones (la variable de la terminal
   tiene prioridad sobre los `.env`):
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.TUREF:TUCLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres?uselibpqcompat=true&sslmode=require"
   npm run migrate:status
   npm run migrate
   ```
5. La primera vez, crea el Administrador en la misma ventana:
   `npm run admin:crear -- --nombre "Nombre" --correo admin@tuempresa.com --documento 123456789`.
6. Cada vez que haya migraciones nuevas: **copia de seguridad primero** (ver más abajo), luego
   `npm run migrate` y después despliega la API. Nunca uses `migrate:down` en producción.

⚠ `npm run db` solo arranca la base **local**: si tu `backend/.env` apunta a Supabase se niega a
correr. Para trabajar en local, deja en `backend/.env` la dirección local y usa la de Supabase
solo en la ventana donde migras.

### 2. API (Render)

Puedes crear el servicio con el archivo `render.yaml` (New → Blueprint) o a mano:

| Configuración | Valor |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/salud` |

Variables de entorno (en el panel de Render, **nunca** en el código ni en el repositorio):

| Variable | Valor |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | La del Session pooler de Supabase (con `?uselibpqcompat=true&sslmode=require`) |
| `DATABASE_SSL` | `no-verify` con Supabase (cifra sin validar su entidad propia); `true` con proveedores de certificado público |
| `JWT_SECRET` | Nueva, larga (≥ 32) y distinta a la de desarrollo |
| `CLAVE_CIFRADO` | Nueva, distinta de `JWT_SECRET`. Si se pierde, los usuarios deben reconfigurar el doble factor |
| `CLOUDINARY_URL` | Cloudinary → *API Keys* → `cloudinary://<api_key>:<api_secret>@<cloud_name>` |
| `RESEND_API_KEY` | Resend → *API Keys* (permiso de envío) |
| `CORREO_REMITENTE` | `MiraLlantas <no-responder@tu-dominio.com>`, de un dominio **verificado** en Resend |
| `FRONTEND_URL` | `https://mirallantas.vercel.app` (arma el enlace del correo; debe ser https) |
| `CORS_ORIGINS` | `https://mirallantas.vercel.app` (sin `*` ni `/` final; separa varios con coma) |
| `EXIGIR_2FA_ADMIN` | `false` (doble factor opcional) o `true` |
| `APP_TIMEZONE` | `America/Bogota` |
| `JWT_EXPIRES_IN` | `8h` |

No definas `PORT`: Render lo pone y la API lo usa. La API se niega a arrancar en producción si
falta Cloudinary, Resend, `FRONTEND_URL` https o si `CORS_ORIGINS` no es https. Comprueba
`https://tu-api.onrender.com/api/salud` → `{"estado":"ok"}`.

**Resend (correo de recuperación)**: crea la cuenta, agrega tu dominio en *Domains* y publica los
registros DNS que te indica (SPF/DKIM); cuando aparezca como *Verified*, crea la API key. Sin dominio
verificado, Resend solo permite enviar a tu propio correo de prueba desde `onboarding@resend.dev`:
para clientes reales el dominio es obligatorio.

### 3. Frontend (Vercel)

1. En **Settings → General → Root Directory** elige `frontend` (Vercel detecta Vite y usa
   `frontend/vercel.json`, que también redirige todas las rutas a la app: recargar `/catalogo` o
   `/restablecer-contrasena` funciona).
2. En **Settings → Environment Variables** agrega (son públicas, nunca secretos):

   | Variable | Valor |
   | --- | --- |
   | `VITE_API_URL` | `https://tu-api.onrender.com/api` (obligatoria: sin ella la app avisa en vez de llamar a localhost) |
   | `VITE_WHATSAPP_NUMERO` | WhatsApp de la empresa, solo dígitos con indicativo (`573108976943`) |
   | `VITE_TELEFONO_EMPRESA` | Teléfono que se muestra (`+57 310 897 69 43`) |

3. Vuelve a desplegar (las variables de Vite se leen al compilar).
4. `vercel.json` ya trae las cabeceras de seguridad (CSP, HSTS, anti-iframe). Con la dirección
   definitiva de la API, cambia en la CSP `connect-src 'self' https:` por
   `connect-src 'self' https://tu-api.onrender.com` para que el sitio solo hable con tu API.

### 4. Pruebas después de desplegar

1. `https://tu-api.onrender.com/api/salud` responde `{"estado":"ok"}`.
2. En `https://mirallantas.vercel.app`: el menú "Catálogo" muestra las llantas sin iniciar sesión.
3. Inicia sesión con el Administrador, cambia la contraseña y (recomendado) activa el doble factor.
4. "¿Olvidaste tu contraseña?" con tu correo: llega el correo de Resend y el enlace abre
   `https://mirallantas.vercel.app/restablecer-contrasena` (no `localhost`).
5. Cliente de prueba: arma el carro, revisa "Solicitar por WhatsApp" (abre WhatsApp con el mensaje)
   y "Enviar solicitud de cotización"; en el panel, emite la cotización, acéptala y registra un abono.
6. Registra los datos reales de la empresa en la tabla `empresa` (los usan los PDF).

### 5. Copias de seguridad y recuperación

- **Supabase** hace copias diarias (*Database → Backups*); en planes pagos hay restauración a un
  punto en el tiempo.
- **Copia propia antes de cada migración**, desde tu equipo con la dirección de Supabase:
  `npm run db:respaldo` (guarda un JSON en `database/respaldos/`, fuera de git: contiene datos
  personales, guárdalo cifrado).
- **Restaurar**: crea una base nueva y vacía, aplícale `npm run migrate` y luego
  `npm run db:restaurar -- respaldos/archivo.json` apuntando a esa base. Comprueba y, si está bien,
  cambia `DATABASE_URL` en Render a la base restaurada.
- Si un despliegue falla: en Vercel, *Promote to Production* de la versión anterior; en Render,
  *Rollback* al despliegue anterior. Una migración ya aplicada no se revierte en producción: se
  corrige con una migración nueva.

---

## Pendiente de decisión

Estos puntos del plan de mejoras esperan una decisión del equipo antes de implementarse:

- Estados de cotización que permiten comprar (hoy: "Aprobada" y "En proceso").
