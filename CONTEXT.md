# Contexto del proyecto — MiraLlantas ERP (Prototipo Frontend)

> Este documento resume todo el trabajo hecho en la conversación anterior con Claude (vía claude.ai),
> para que Claude Code pueda continuar el desarrollo con el contexto completo. Pégalo como primer
> mensaje en Claude Code, o guárdalo como `CONTEXTO.md` en la raíz del repo y referencia el archivo.
>
> **Nota (estructura actual):** el proyecto ya es un monorepo con `frontend/`, `backend/` y
> `database/`. Las rutas `src/…` de este documento son del frontend (hoy `frontend/src/…`).
> La estructura vigente y los comandos están en el `README.md`.

## 1. Qué es este proyecto

**MiraLlantas ERP** es un proyecto académico (SENA, tecnólogo ADSO) que consiste en construir un
**prototipo frontend** (sin backend real) de un sistema ERP para una microempresa de venta y
reencauche de llantas en Medellín / Valle de Aburrá. El prototipo cubre:

- Un **Panel Admin** (dashboard, gestión de usuarios/roles/clientes/proveedores/terceros, catálogo,
  operación, finanzas).
- Un **Portal de Cliente** (self-service: catálogo, pedidos, créditos, abonos, entregas, reencauches).
- Una **Landing page** pública y una página de **Login**.

El diseño de referencia viene de capturas de **Figma Make** (no hay acceso directo al archivo Figma
en este entorno, solo capturas de pantalla que el usuario fue compartiendo). El alcance actual es
**solo WEB**; **Mobile queda pendiente** para una siguiente iteración (hay diseños de Figma para
mobile aún no implementados).

## 2. Stack técnico (decidido y ya implementado)

- **React + Vite** (JavaScript, no TypeScript)
- **Tailwind CSS v3** (`darkMode: 'class'`)
- **react-router-dom** para el enrutamiento
- **recharts** para las gráficas del dashboard (área + donut)
- **lucide-react** para iconografía general
- **react-icons/fa** específicamente para los logos exactos de WhatsApp/Facebook/Instagram (lucide
  no tiene logos de marca fieles)
- Sin backend: todos los datos vienen de `src/data/mockData.js` (pensado como punto de reemplazo
  limpio por llamadas REST reales — hay documentos de arquitectura SOA/C4 del proyecto que definen
  cómo sería esa API)
- Persistencia de tema (claro/oscuro) en `localStorage`, con detección de `prefers-color-scheme`
  en el primer render

## 3. Estado de la entrega

Ya se entregó un `.zip` (`mirallantas-erp.zip`) con el proyecto completo y funcional
(`npm install && npm run dev`), verificado visualmente en claro y oscuro contra las capturas
originales de Figma Make mediante Playwright (capturas de pantalla comparadas 1:1). **Todo lo
descrito abajo ya está implementado y probado**, no es un plan pendiente.

## 4. Arquitectura de carpetas (patrón "Features / Base", pedido explícitamente por el usuario)

```
src/
├── components/
│   ├── base/                    ← Átomos reutilizables en TODA la app (sin lógica de negocio)
│   │   ├── Badge/                 pastillas de estado (Aprobado, Pendiente, Vencido, etc.)
│   │   ├── DataTable/             tabla genérica: búsqueda, paginación (8 filas), acciones
│   │   ├── EmptyState/            estado vacío con icono (lucide) + texto
│   │   ├── Footer/                footer de marca (ver sección 6, fue lo primero que se construyó)
│   │   ├── Logo/                  insignia "ML"/"M" + wordmark "MiraLlantas"
│   │   ├── Modal/                 modal genérico (usado por el detalle de producto)
│   │   ├── PageHeader/            breadcrumb reutilizable
│   │   ├── StatCard/              tarjeta de KPI (icono + valor + tendencia)
│   │   ├── ThemeToggle/           botón sol/luna
│   │   └── TireThumb/             miniatura ilustrada de producto (placeholder con gradiente + icono,
│   │                              NO hay fotos reales — ver sección 8)
│   └── layout/                  ← Layouts por zona de la app (sí tienen lógica de navegación)
│       ├── AdminLayout.jsx        compone Sidebar + Topbar + <Outlet/>
│       ├── AdminSidebar.jsx       sidebar SIEMPRE oscuro (navy), colapsable, agrupado por secciones
│       ├── AdminTopbar.jsx        título de página + ThemeToggle + notificaciones + usuario
│       ├── ClientLayout.jsx       compone ClientNavbar + <Outlet/> + footer simple
│       ├── ClientNavbar.jsx       navbar horizontal con links (Inicio/Catálogo/Mis .../Salir)
│       └── PublicNavbar.jsx       navbar de la landing (Módulos/Características/Contacto/Acceder)
│
├── features/                    ← Una carpeta por pantalla o dominio (con lógica de negocio/datos)
│   ├── landing/
│   │   ├── LandingPage.jsx        compone: PublicNavbar + Hero + Features + Modules + CTA + Footer
│   │   ├── Hero.jsx                titular + CTA + barra de stats (+500, $2.1B, 15+, 99.9%)
│   │   ├── Features.jsx            3 tarjetas (Fácil de usar / Seguro por diseño / Datos en tiempo real)
│   │   ├── Modules.jsx             grid de 8 módulos del sistema (con link a /login)
│   │   └── CTA.jsx                 sección final "¿Listo para empezar?"
│   ├── auth/
│   │   └── LoginPage.jsx          panel de marca (stats mini) + formulario + cuentas demo
│   │                              (botones de cuentas demo navegan directo a /admin o /portal)
│   ├── admin/
│   │   ├── dashboard/DashboardPage.jsx   KPIs + AreaChart + PieChart (recharts) + últimos pedidos + alertas
│   │   ├── usuarios/UsuariosPage.jsx
│   │   ├── roles/RolesPage.jsx
│   │   ├── clientes/ClientesPage.jsx
│   │   ├── proveedores/ProveedoresPage.jsx
│   │   ├── terceros/TercerosPage.jsx
│   │   └── generic/              ← páginas que NO tenían captura de referencia, construidas
│   │       │                       reutilizando DataTable + mock data para que la app no tenga
│   │       │                       callejones sin salida en la navegación
│   │       ├── ProductosPage.jsx
│   │       ├── CategoriasPage.jsx
│   │       ├── PedidosCotizacionPage.jsx
│   │       ├── OrdenesCompraPage.jsx
│   │       ├── EntregasPage.jsx
│   │       ├── ReencauchePage.jsx
│   │       ├── CreditosPage.jsx
│   │       └── AbonosPage.jsx
│   └── portal/
│       ├── ClientHomePage.jsx         "Bienvenida, María" + KPIs + accesos rápidos
│       ├── CatalogoPage.jsx           grid de productos + filtros + Modal de detalle
│       ├── ClientPedidosPage.jsx      tabla simple (sin toolbar de exportar/nuevo, sin editar/eliminar)
│       ├── ClientCreditosPage.jsx     estado "sin cupo" + botón "Solicitar crédito"
│       ├── ClientAbonosPage.jsx       replica EXACTA del estado vacío de la captura (dos íconos apilados)
│       ├── ClientEntregasPage.jsx     EmptyState "Sin entregas activas"
│       └── ClientReencauchesPage.jsx  timeline de 3 pasos (Recepción → En proceso → Finalizado)
│
├── context/
│   └── ThemeContext.jsx         ← ThemeProvider + useTheme(), persistido en localStorage,
│                                  respeta prefers-color-scheme en el primer load
│
├── data/
│   └── mockData.js              ← ÚNICA fuente de datos de ejemplo de toda la app. Exporta:
│                                  dashboardStats, salesVsPurchases, salesByBrand, recentOrders,
│                                  systemAlerts, usuarios, roles, clientes, proveedores, terceros,
│                                  productos, categorias, ordenesCompra, creditos, abonos, entregas,
│                                  reencauches, clientProfile, clientHomeStats, clientOrders,
│                                  clientReencauches
│
├── App.jsx                      ← Router raíz (BrowserRouter + Routes), envuelto en ThemeProvider
└── index.css                    ← @tailwind directives + import de Google Fonts (Playfair Display
                                    para el wordmark del Footer, Plus Jakarta Sans para el resto)
```

## 5. Mapa de rutas implementado

```
/                              → LandingPage
/login                         → LoginPage

/admin                         → AdminLayout (Sidebar + Topbar)
  (index)                      → DashboardPage
  /usuarios                    → UsuariosPage
  /roles                       → RolesPage
  /clientes                    → ClientesPage
  /proveedores                 → ProveedoresPage
  /terceros                    → TercerosPage
  /productos                   → ProductosPage
  /categorias                  → CategoriasPage
  /pedidos-cotizacion          → PedidosCotizacionPage
  /ordenes-compra              → OrdenesCompraPage
  /entregas                    → EntregasPage
  /reencauche                  → ReencauchePage
  /creditos                    → CreditosPage
  /abonos                      → AbonosPage

/portal                        → ClientLayout (ClientNavbar)
  (index)                      → ClientHomePage
  /catalogo                    → CatalogoPage
  /pedidos                     → ClientPedidosPage
  /creditos                    → ClientCreditosPage
  /abonos                      → ClientAbonosPage
  /entregas                    → ClientEntregasPage
  /reencauches                 → ClientReencauchesPage
```

Desde `/login`, el bloque "CUENTAS DE DEMOSTRACIÓN" tiene 2 botones (Administrador / Cliente) que
navegan directo a `/admin` o `/portal` respectivamente — **no hay autenticación real**, es solo
navegación de prototipo.

## 6. Historia del desarrollo (por si se necesita el "por qué" de alguna decisión)

1. **Primer encargo**: solo el **Footer** (con dark/light), porque no estaba en el Figma Make.
   Se construyó pixel-sampleando una captura de referencia del Footer (colores exactos extraídos
   con PIL: navy `#12161C`/`#0B0E13`, dorado `#C9A876`, colores de marca exactos para WhatsApp
   `#00D492` / Facebook `#2196F3` / Instagram `#EC4899`). Ese Footer sigue siendo el mismo
   componente base (`src/components/base/Footer`), con su propio estilo "de marca" (wordmark en
   fuente serif Playfair Display), distinto del resto de la UI de la app (que usa un logo
   sans-serif bold ámbar, ver `Logo.jsx`) — **esto es intencional**, replica dos tratamientos de
   marca distintos que aparecían en las capturas originales (footer de marketing vs. chrome de app).

2. **Segundo encargo**: "no solo el footer, hazlo todo" — el usuario compartió ~20 capturas de
   pantalla del Figma Make cubriendo: Landing (hero, stats, features, módulos, CTA) en claro y
   oscuro, Login, Dashboard Admin (claro y oscuro), tablas de Usuarios/Roles/Clientes/Proveedores/
   Terceros, y el Portal de Cliente completo (home, catálogo, modal de producto, pedidos, abonos
   vacío, reencauches con timeline).

3. Se construyó todo reutilizando el mismo proyecto Vite del Footer (no se empezó de cero), 
   extendiendo `tailwind.config.js` con un nuevo acento **ámbar vivo** (`amber.400 #FBBF24`) para
   botones/KPIs/enlaces activos de toda la app (distinto del dorado apagado `brand.gold` que quedó
   reservado solo para el Footer).

4. **Bugs encontrados y corregidos durante la verificación visual con Playwright**:
   - El `AreaChart` de recharts mostraba el eje Y con etiquetas cortadas/ilegibles ("3M", "1M",
     "$M"...) → se corrigió fijando `domain={[0, 32]}`, ajustando `margin` y `width` del `YAxis`.
   - El `PieChart` (donut "Ventas por Marca") se renderizaba roto (un fragmento pequeño en una
     esquina en vez de un anillo completo) → causado por capturar la screenshot mid-animación de
     entrada de recharts en un contenedor de tamaño fijo sin `ResponsiveContainer`. Se corrigió
     añadiendo `isAnimationActive={false}` en el `<Pie>` y fijando `width`/`height` explícitos en
     `<PieChart>` en vez de `ResponsiveContainer` (que no se comportaba bien en un contenedor chico).

5. Todas las vistas se verificaron tomando **capturas reales con Playwright** (`npx playwright
   install chromium`, servidor `vite preview`) en `/`, `/login`, `/admin`, `/admin/usuarios`,
   `/portal`, `/portal/catalogo`, `/portal/reencauches`, `/portal/abonos`, en claro y oscuro, y
   comparándolas visualmente contra las capturas originales del usuario.

## 7. Paleta de marca (Tailwind `theme.extend.colors`, en `tailwind.config.js`)

```js
colors: {
  brand: {
    navy: {
      DEFAULT: '#12161C', 50: '#F3F4F6', 100: '#E3E5E9', 200: '#C6CAD1',
      700: '#1B2230', 800: '#161B24', 900: '#12161C', 950: '#0B0E13',
    },
    gold: { 300: '#E4D3A6', 400: '#D9C08C', 500: '#C9A876', 600: '#B08D52', 700: '#8A6D3C' },
    whatsapp: '#00D492', facebook: '#2196F3', instagram: '#EC4899',
    amber: { 300: '#FCD34D', 400: '#FBBF24', 500: '#F5B914', 600: '#D69E0A' },
  },
},
fontFamily: {
  serif: ['"Playfair Display"', 'Georgia', 'serif'],   // solo el wordmark del Footer
  sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], // el resto de la app
},
```

- **Acento principal de la app** (botones, KPIs positivos, enlaces activos, badges "amber"): usar
  las clases utilitarias de Tailwind `amber-400` / `amber-500` (Tailwind ya trae esta escala; NO
  hace falta usar `brand.amber`, se usa directamente `bg-amber-400`, `text-amber-400`, etc., en
  casi todo el código — `brand.amber` quedó definido mayormente por completitud/documentación).
- **Sidebar del Admin**: SIEMPRE `bg-brand-navy-950`, sin importar el tema activo — así aparecía en
  las capturas originales (solo el contenido y el topbar cambian con el tema).
- **Iconos de redes sociales**: usar los hex exactos (`whatsapp`/`facebook`/`instagram`), NO los
  colores por defecto de Tailwind, porque fueron pixel-sampleados de la captura real.

## 8. Limitaciones conocidas / deuda técnica intencional

- **Sin backend real**: todo viene de `src/data/mockData.js`. El reemplazo por API REST debe
  respetar la forma de cada array/objeto exportado (columnas de `DataTable`, keys usadas en cada
  `feature`).
- **Sin autenticación real**: el login es solo navegación (no valida credenciales).
- **Fotos de producto**: no hay imágenes reales ni URLs externas; el catálogo usa
  `TireThumb` (gradiente por marca + icono `Disc3` de lucide) como placeholder visual. Reemplazar
  por `<img src={...} />` en cuanto haya assets reales o una URL de CDN.
- **Páginas "genéricas" del Admin** (Productos, Categorías, Pedidos-Cotización, Órd. de Compra,
  Entregas, Reencauche, Créditos, Abonos): no había captura de Figma de referencia para estas, así
  que se construyeron con el mismo componente `DataTable` genérico y columnas razonables, para que
  la navegación del sidebar no tenga callejones sin salida. **Si aparecen capturas de Figma para
  estas pantallas, hay que rehacerlas a medida** (como se hizo con Usuarios/Roles/Clientes/
  Proveedores/Terceros).
- **Mobile**: no implementado. Hay Figma de mobile pendiente de revisar; la idea es reutilizar
  `ThemeContext`, `mockData.js` y la lógica de cada `feature`, cambiando sobre todo los `layout/`
  (sidebar → drawer o menú inferior) y los grids a una columna.
- **Bundle size**: Vite avisa que el chunk final (~1.3MB / 360KB gzip) supera los 500KB
  recomendados (por recharts + react-icons + react-router-dom todo en un solo chunk). Pendiente de
  optimizar con `React.lazy()` / code-splitting por ruta si se vuelve un problema real.
- **Fuentes**: `index.css` importa Google Fonts vía `@import url(fonts.googleapis.com/...)`. Si el
  entorno de build no tiene salida a internet, esa línea puede fallar o retrasar el build sin
  romperlo (el CSS sigue siendo válido, solo cae a la fuente de fallback del sistema).

## 9. Documentos de referencia del proyecto (mencionados por el usuario, no leídos a fondo aún)

El usuario tiene en su Project de claude.ai estos documentos que dan contexto adicional del
proyecto académico (arquitectura, historias de usuario, etc.) — vale la pena revisarlos si Claude
Code necesita más contexto de negocio o de la arquitectura backend planeada:

- `Ficha_de_proyecto_PRESENTABLE.docx`
- `Arquitectura_MiraLlantas_Hardware.docx`
- `Arquitectura_Software_MiraLlantas.docx`
- `MiraLlantas_Diagramas_C4_1__1_.docx`
- `MiraLlantas_Presentación.pdf`
- `Matriz_Historias_de_Usuario_Ver_02_Abril_2023.xlsx`
- Links de Figma: `Link_Figma_WEB`, `Link_Figma_MOBILE`, `Link_Figma__Patrones_De_Diseño_`
  (URL de Figma Make: `https://www.figma.com/make/iSdj9quwQdi8IAoB2zrB4M/MiraLlantas-ERP-UI-UX-Prototype`)

## 9-bis. Modales y formularios (iteración posterior)

Se agregó la capa de CRUD por modales flotantes, replicando las capturas de Figma de
"Nuevo usuario", "Editar usuario", "Detalle usuario" y "¿Eliminar registro?":

- `components/base/Modal` — reescrito: se monta con `createPortal` sobre `document.body`,
  desenfoca el fondo de la app (`backdrop-filter: blur`, clases `.ml-backdrop` / `.ml-panel`
  definidas en `index.css`) y lo devuelve a la normalidad con una animación de salida.
  Cierra con Escape, con la X o haciendo click fuera; bloquea el scroll del body.
  Props: `title`, `subtitle`, `icon`, `tone` (default/danger/info), `size` (sm/md/lg/xl),
  `footer` (nodo o función que recibe el cierre animado), `onClose`.
- `components/base/FormModal` — formulario dirigido por esquema. Cubre los tres modos
  (`create`, `edit`, `view`) con la misma definición de campos. Valida los obligatorios,
  formatea los campos `type: 'money'` al guardar y admite campos exclusivos de un modo con
  `only: 'create'` (la contraseña, por ejemplo). `Field.jsx` renderiza cada tipo de input.
- `components/base/ConfirmDialog` — confirmación de borrado; además del texto de la captura
  muestra qué registro se va a eliminar.
- `components/base/DataTable` — ahora cablea los cuatro modales: el botón "+ Nuevo" del
  toolbar y los iconos ver/editar/eliminar de cada fila. Mantiene las filas en estado local,
  así que crear/editar/eliminar se refleja en la tabla (prototipo, sin backend). Nuevas props:
  `formSections`, `entityName`, `titleKey`. Si una página no pasa `formSections` se deriva un
  esquema básico desde `columns`.

Cada página del Admin define su propio `formSections` (Usuarios, Roles, Clientes, Proveedores,
Terceros, Productos, Categorías, Pedidos-Cotización, Órd. de Compra, Entregas, Reencauche,
Créditos, Abonos). En el portal, `ClientPedidosPage` sólo expone el modal de detalle.

### Portal de cliente — carrito, servicios y listados en cartas

- **El botón "+ Crear pedido-cotización" vive únicamente en el Catálogo** (arriba a la izquierda),
  con el contador de líneas del carrito.
- `context/CartContext.jsx` — carrito del pedido en curso, montado en `ClientLayout` para que
  sobreviva a la navegación entre catálogo y formulario. Refleja las dos tablas de detalle:
  `productos` → `cotizacion_detalle_producto` y `servicios` → `cotizacion_detalle_servicio`
  + `evidencia_carcasa`.
- `CatalogoPage` — buscador y filtros ya funcionales (marca, tipo de vehículo, medida, categoría),
  precio por producto y botón "Agregar" en cada carta y en el modal de detalle.
- `/portal/nuevo-pedido` (`NuevoPedidoPage.jsx`) — ya no es un formulario suelto sino el **carrito**:
  líneas de producto con selector de cantidad y subtotal, líneas de servicio con la miniatura de la
  foto de la carcasa, y una barra lateral con proveedor, método de pago y total estimado.
  El botón "Agregar servicio" abre un `FormModal` con los campos de `cotizacion_detalle_servicio`
  (servicio, cantidad de llantas, precio unitario) y de `evidencia_carcasa` (foto de la llanta,
  descripción, estado de aptitud y observaciones).
- `components/base/CardList` — listado en cartas para el portal: buscador, filtros por campo y
  **paginación solo cuando se superan 10 registros**. Lo usan Mis Pedidos, Mis Créditos,
  Mis Abonos, Mis Entregas y Mis Reencauches, que antes mostraban estados vacíos o una tabla.

### Registro de abonos desde el portal

- `context/AbonosContext.jsx` — lista de abonos del cliente, montada en `ClientLayout` para que
  "Mis Abonos" y el detalle de un crédito compartan siempre los mismos datos.
- `features/portal/RegistrarAbonoModal.jsx` — modal de "+ Registrar abono": mini-listado donde el
  cliente elige **un solo** crédito (los ya pagados quedan deshabilitados), monto con validación
  contra el saldo, fecha, método de pago, nº de comprobante y la subida del **pantallazo de la
  consignación** (`abono.comprobante_pago`). Calcula el saldo restante al guardar.
- Se usa desde dos sitios: el botón "+ Registrar abono" de **Mis Abonos**, y el mismo botón dentro
  del **detalle de un crédito** (ahí el crédito llega preseleccionado y bloqueado).
- `ClientCreditosPage` — las cartas ahora son clicables y abren un modal con el resumen del crédito
  y su **historial de abonos**, con la miniatura del soporte de cada pago.

### Iconos del sidebar del Admin

Se alinearon con el mockup: Clientes `UserRoundPlus`, Proveedores `Building2`, Terceros `Landmark`,
Productos `Disc3` (llanta) y Abonos `Receipt`. El resto ya coincidía.

### Responsive, catálogo dividido y perfil del admin

- **Responsive**: el sidebar del admin se vuelve cajón por debajo de `lg` (se abre con el botón de
  menú del topbar, sobre un velo desenfocado) y sigue siendo fijo y colapsable en escritorio. El
  navbar del portal pasa a menú hamburguesa por debajo de `lg`. Se ajustaron paddings, títulos y
  las barras de herramientas para que envuelvan en pantallas chicas; las tablas ya scrollean en
  horizontal dentro de su contenedor.
- **Catálogo dividido**: el botón "+ Crear pedido-cotización" ya no navega, **parte la pantalla en
  dos**: catálogo a la izquierda y el pedido a la derecha (columna pegajosa de 380px). Agregar un
  producto abre la columna automáticamente. En móvil las dos partes se apilan con el pedido arriba.
  El contenido del pedido vive en `features/portal/PedidoPanel.jsx` y lo comparten el catálogo y la
  ruta `/portal/nuevo-pedido`.
- **Dashboard del admin**: se retiraron los KPIs de Clientes Activos y Crédito Vigente, la gráfica
  "Ventas vs Compras" y el panel "Alertas del Sistema"; entró **"Reencauches por mes"** (barras) y
  "Últimos Pedidos" pasó a ancho completo. También se quitó el botón de notificaciones del topbar.
- **Perfil del administrador**: la foto/avatar del topbar abre un modal con su información editable
  (foto, nombre, documento, correo, teléfono, rol, estado y cambio de contraseña). El estado vive en
  `AdminLayout`, así que el nombre y las iniciales se actualizan en el topbar y en el sidebar.

### Alineación con el modelo de datos v2 (dbdiagram)

Los **formularios y modales** (no las columnas de los listados, que se dejaron intactas) usan los
campos del modelo v2: `usuario`/`cliente` separados, `tipo_vehiculo` como catálogo, medidas
separadas en ancho/perfil/rin, categorías M:N por chips, `producto_imagen` como campo de foto,
proveedor y `url_recibo` a nivel de cotización, crédito ligado a una cotización (plazo_dias,
fecha_inicio, fecha_limite), abono 1:1 con crédito (monto_pagado, saldo_pendiente,
comprobante_pago) y orden de reencauche con sus fechas, tiempo estimado y garantía.
`mockData.js` exporta los catálogos correspondientes (`tiposDocumento`, `metodosPago`,
`tiposVehiculo`, `marcas`, `modulosPermiso`, `servicios` y un `estadosX` por módulo).

`Field.jsx` sumó dos tipos nuevos: `image` (subida de foto con previsualización, usada para la
carcasa, la evidencia de entrega y la foto del producto) y `checkboxes` (relaciones M:N como
`rol_permiso` y `producto_categoria`). `DataTable` acepta `normalize` para derivar las columnas
del listado desde los valores del formulario (p. ej. la medida a partir de ancho/perfil/rin).

### Marca, estados y armado del pedido en el Admin

- **Login y landing**: se quitaron los KPIs del panel de marca del login y en su lugar (y en la
  entrada de la landing) va una ilustración de llantas de camión, `components/base/TruckTire`.
  Es un SVG y no una foto: el prototipo no tiene assets reales, así escala, respeta la paleta y no
  depende de archivos externos.
- **Logo estandarizado**: el Footer dejó de usar el wordmark serif propio y ahora usa el mismo
  `Logo` con la insignia "ML" que el resto de la app.
- **Módulo de Clientes retirado del Admin**: como en la BD `cliente` extiende a `usuario` 1:1, los
  clientes se gestionan desde Usuarios filtrando por rol. Se quitó del sidebar, de las rutas y de
  `modulosPermiso`; el listado de Usuarios ganó filtros por **Rol** y por **Estado**.
- **Estados estandarizados y editables desde la lista**: `components/base/StatusSelect` se ve igual
  que un `Badge` pero es un `<select>`, así que el estado se cambia sin abrir el modal de edición.
  `DataTable` lo usa cuando la página pasa `statusOptions`, y ahora **todos** los listados del admin
  tienen columna Estado con su catálogo (`estadosActivo` para Usuarios, Roles, Proveedores,
  Terceros y Categorías; los catálogos por módulo para el resto). Ojo: en el dbdiagram solo
  `usuario` y `producto` tienen `activo`, así que las otras tablas necesitarían esa columna.
- **Nuevo pedido-cotización del Admin** (`features/admin/generic/NuevoPedidoModal.jsx`): en vez del
  formulario genérico, el admin arma el detalle — una tabla con todo el catálogo del sistema (con
  buscador) desde la que agrega productos, edita la cantidad y los quita, más "Agregar servicio",
  que abre el mismo formulario que usa el cliente. El esquema de esa línea de servicio vive en
  `features/shared/servicioSections.js`, compartido por el portal y el admin. `DataTable` acepta
  `createModal` para reemplazar el formulario de "Nuevo" por uno a medida.

### Ajustes de estados, acordeón y desplegables

- **Estados retirados** de Usuarios, Roles, Créditos y Categorías (listado y formulario). Los que
  siguen siendo binarios — Proveedores y Terceros — ya no usan un desplegable sino
  `components/base/StatusSwitch`: un `<button role="switch">` verde/rojo que se cambia desde la
  fila. `DataTable` elige entre `StatusSelect` y `StatusSwitch` con la prop `statusVariant`.
- **Abonos** suma el estado **Rechazado** a `estadosAbono` (ya tenía color rojo en el `Badge`).
- **Sidebar del Admin en acordeón**: cada sección tiene un botón junto al título; todo arranca
  desplegado y solo se guardan las secciones que el usuario cierra. La animación usa
  `grid-template-rows` de `1fr` a `0fr`, así no hay que medir alturas ni usar `max-height`.
- **Landing**: se quitaron las ilustraciones de llantas del hero y volvió a ser texto + CTA +
  barra de stats. `TruckTire` sigue en uso solo en el login.
- **Portal · Mis Pedidos**: cada carta tiene un botón "Ver detalle" que despliega las líneas de la
  cotización (producto o servicio, medida, cantidad, unitario y subtotal). El estado abierto se
  guarda por id, así que se pueden tener varias cotizaciones desplegadas a la vez. Los datos de
  cada línea viven en `clientPedidos[].detalle`.
- **Portal · perfil del cliente**: la foto del navbar abre el mismo modal de perfil que el admin,
  con sus datos de `usuario` más la dirección de facturación de `cliente`. El estado vive en
  `ClientLayout`, así que el nombre y las iniciales del navbar se actualizan al guardar.
- **Sin APIs deprecadas**: se reemplazaron los alias de lucide `AlertTriangle` → `TriangleAlert` y
  `Home` → `House`. El resto de los 50 iconos usados están vigentes (auditado contra los tipos del
  paquete), y la app ya usaba `createRoot` sin `defaultProps` ni `findDOMNode`.

### Portal reorganizado alrededor de "Mis Pedidos"

- **Scrollbars propios**: en `index.css` se reemplaza la barra nativa por una delgada, sin flechas
  ni riel, gris apagada en reposo y ámbar al pasar el cursor (`scrollbar-width`/`scrollbar-color`
  para Firefox y `::-webkit-scrollbar` para el resto). Aplica a la ventana y a cualquier contenedor
  con overflow.
- **Se eliminaron del portal las vistas de Créditos, Abonos y Entregas**. Toda esa información pasó
  al detalle de cada pedido en `ClientPedidosPage`:
  - Los pedidos financiados a crédito se ordenan primero y llevan un **contorno según el estado del
    crédito**: verde "Al día", rojo "Vencido" y gris "Pagado".
  - Arriba a la izquierda de la carta van los **dos estados etiquetados** — "Crédito" y "Pedido" —
    cuando el pedido es a crédito; los de contado muestran solo "Pedido".
  - Al desplegar el detalle aparecen las líneas de la cotización, el resumen del crédito con su
    historial de abonos y el botón "+ Registrar abono" (reutiliza `RegistrarAbonoModal`).
  - Cada línea de **servicio** trae su propio desplegable con la ficha del reencauche (modalidad,
    taller, fechas, garantía, estado de la evidencia y observaciones), en `clientPedidos[].detalle[].fichaServicio`.
  - Un botón verde **"Ver estado de la entrega"** abre `EntregaModal` con el seguimiento del
    despacho. Solo se habilita cuando el pedido está en el nuevo estado **"Por entregar"**; en
    cualquier otro caso queda deshabilitado.
- Para que ese botón tenga sentido se añadió **"Por entregar"** a `estadosCotizacion` (entre
  "En proceso" y "Entregado"), con su color ámbar en el `Badge`. Los módulos de Créditos, Abonos y
  Entregas del **Admin siguen intactos**.

### Mis Pedidos como único listado del portal

- **Mis Reencauches también se retiró** del portal. El avance de cada orden se consulta ahora con
  el botón "Ver estado del reencauche" dentro del detalle del servicio, que abre
  `features/portal/ReencaucheModal.jsx` (misma idea que `EntregaModal`). Los datos de la orden
  —número, estado, paso, taller, fechas, garantía y evidencia— viven en
  `clientPedidos[].detalle[].fichaServicio`, y se eliminó el arreglo `clientReencauches`.
- **Cartas de altura independiente**: `CardList` pinta el grid con `items-start`, así una carta
  desplegada ya no estira a las de su misma fila.
- **Fondo tenue además del contorno**: los pedidos a crédito llevan borde y fondo del mismo tono
  (verde "Al día", rojo "Vencido", gris "Pagado"), lo que los hace visibles también en modo claro.
- **Barra de búsqueda fija y discreta**: con `stickyToolbar`, `CardList` deja la barra pegada bajo
  el navbar, con fondo translúcido y controles de menor contraste para no competir con las cartas.
- **Más filtros y orden**: además de Pedido y Pago, hay filtros derivados de **Crédito**, **Entrega**
  y **Reencauche** — un filtro puede traer su propio `match(item, valor)` cuando el dato está
  anidado — y un orden por **fecha** (más recientes / más antiguas) vía `sortOptions`, que respeta
  la regla de mostrar primero los pedidos a crédito. El buscador también encuentra por número de
  crédito, de entrega y de orden de reencauche.
- **Sidebar del Admin**: desapareció la sección "PRINCIPAL"; el Dashboard quedó como enlace fijo
  arriba de todo, fuera del acordeón y siempre visible.

### Desplegables de filtro con la paleta de la app

`components/base/Dropdown` reemplaza al `<select>` nativo en los filtros. El nativo pinta su lista
con los colores del sistema operativo (fondo gris y resaltado azul), que no se pueden estilizar de
forma fiable; el componente propio usa el fondo de la tarjeta, borde suave, sombra y deja la opción
activa en ámbar con un check. Trae su propia opción "Todos" para limpiar el filtro, se cierra al
hacer click fuera o con Escape, y expone `role="listbox"`/`role="option"`. La variante `subtle` es
la que usa la barra fija del portal. Lo usan los filtros y el orden de `CardList` (portal) y los
filtros de `DataTable` (admin).

### El cliente solo pide; el asesor cotiza

Se recortaron los formularios del portal a lo que el cliente realmente decide, dejando al asesor
lo que es propio de la cotización:

- **Registrar abono**: desaparece el mini-listado "Crédito a abonar" —el abono se aplica siempre al
  crédito desde el que se abrió el modal, que ahora recibe `creditoId` y solo lo muestra como
  ficha informativa— y también el número de comprobante y la fecha. Quedan monto, método de pago y
  el pantallazo de la consignación; la fecha la pone el sistema y el comprobante lo registra el
  asesor al confirmar.
- **Crear pedido-cotización (cliente)**: sin el selector de proveedor.
- **Agregar servicio**: `features/shared/servicioSections.js` pasó a exportar dos variantes.
  `servicioSectionsCliente` deja solo cantidad de llantas, foto, descripción y observaciones —la
  línea entra como "Reencauche", sin precio (se muestra "por cotizar") y con la evidencia en
  "Pendiente de revisión"—, mientras `servicioSectionsAdmin` conserva servicio, valor unitario y
  estado de la evidencia para el "Nuevo pedido" del administrador.
- **Home del cliente**: se retiró el panel de accesos rápidos; los pedidos recientes ocupan ahora
  todo el ancho.

### Cupo de crédito y cotización sin valores

La app dejó de manejar precios de producto: el cliente pide y el asesor cotiza.

- **Sin precios**: se quitó `precio` de `productos` y todo lo que lo mostraba (catálogo, panel del
  pedido, tabla del "Nuevo pedido" del admin). El formulario de servicio del admin tampoco captura
  ya el valor unitario.
- **`context/CreditoContext.jsx`** — nuevo, montado en `App` por encima de los layouts para que lo
  compartan portal y administrador. Parte de un cupo fijo (`CUPO_CREDITO_TOTAL`, 2 millones) del que
  descuenta lo comprometido en créditos vigentes; expone `saldoUsable`, `alcanza(valor)` y
  `comprometer(valor)`. Los saldos de `clientCreditos` se ajustaron para caber dentro del cupo.
- **Saldo usable a la vista**: chip verde en el navbar del portal junto al nombre y una quinta
  tarjeta de KPI en el home del cliente.
- **Crédito como método de pago**: `metodosPago` lo incluye. Al elegirlo en el pedido aparece un
  bloque con el saldo usable, el valor a financiar, el plazo (30/60/90 días) y la cuota aproximada;
  si el valor excede el saldo no deja guardar.
- **Aviso al enviar**: `features/portal/CotizacionEnviadaModal.jsx` muestra el teléfono y el
  WhatsApp de contacto (los mismos del footer) y, si aplica, el resumen del crédito solicitado.
- **Total editable en el admin**: la columna Total de Pedidos-Cotización usa
  `features/admin/generic/TotalCotizacion.jsx`. Las cotizaciones nacen en `$ 0` y sin confirmar, así
  que arrancan en modo edición; el botón "Confirmar" solo existe mientras el input está abierto.
  Al confirmar, si el pedido es a crédito, el valor se descuenta del saldo usable del cliente.
  Para esto `DataTable` pasa a `render(row, { update })`, de modo que una celda pueda actualizar su
  propia fila.
- **Abonos**: el pantallazo de la consignación solo se pide cuando el método de pago no es efectivo.

### Comprobantes, altas desde listado y cancelación de entregas

- **Comprobante de venta** (`features/shared/ComprobanteVentaModal.jsx`): se arma solo con lo que ya
  quedó en el pedido —datos de MiraLlantas, cliente, método de pago, ítems, total y pie de
  contacto—; nadie lo captura. El administrador lo abre con el botón de la columna Acciones y el
  cliente con "Ver recibo" en el detalle de su pedido. En ambos casos solo aparece cuando la
  cotización está cerrada (`ESTADO_COTIZACION_COMPLETADA`, hoy "Entregado").
- **Sidebar del admin**: toda la cabecera de la sección pliega y despliega, no solo el chevron.
- **`features/admin/shared/SelectorPedidos.jsx`**: listado de cotizaciones con buscador, filtro por
  fecha y filtro por cliente, en vez del desplegable de IDs sueltos. Lo usan las dos altas nuevas:
  - `NuevaOrdenCompraModal` — sin fecha de la orden (es la de hoy) ni estado (nace "Pendiente").
  - `NuevaEntregaModal` — al elegir la cotización trae nombre, teléfono y dirección del cliente
    desde su ficha; la fecha es la de hoy y el estado nace "Pendiente". El motivo de cancelación
    ya no se captura al crear: solo se ve al editar o en el detalle.
- **`context/EntregasContext.jsx`**: una sola lista de entregas para admin y portal (antes había
  `entregas` y `clientEntregas` por separado), montada en `App`. El flujo de cancelación la cruza:
  1. El cliente pulsa "Cancelar entrega" en el seguimiento, escribe el motivo y la entrega pasa a
     **"Solicitud de cancelación"** con el trámite en "Pendiente de revisión".
  2. En el listado del admin esa fila muestra un botón extra que abre `SolicitudCancelacionModal`
     con el motivo. Ahí se **aprueba** (la entrega queda "Cancelado") o se **rechaza**, y el
     formulario del motivo del rechazo solo aparece al pulsar "Rechazar".
  3. El cliente ve el resultado en el mismo modal: "Aprobada" o "Rechazada" con la respuesta del
     asesor.
- `DataTable` sumó dos capacidades para esto: modo controlado (`rows` / `onRowsChange`, para listas
  que viven en un contexto) y `rowActions(row)` para botones extra en la columna de acciones.
  `FormModal` acepta ahora `only: ['edit', 'view']` además de un solo modo.

### Catálogo, filtros múltiples y acceso denegado

- **Filtros con selección múltiple** en todos lados: `Dropdown` acepta `multiple`, y `DataTable`,
  `CardList`, el catálogo del cliente y el selector de cotizaciones guardan un arreglo por filtro
  (la fila entra si coincide con cualquiera de las opciones marcadas).
- **Productos**: nuevo estado "No disponible"; la categoría pasó a obligatoria; el listado avisa con
  una pastilla discreta ("Sin foto") cuando al producto le falta la imagen; se quitaron el código de
  producto del alta y el botón de exportar.
- **El estado ya no se captura al crear** en ningún módulo (`only: ['edit', 'view']`): cada entidad
  nace con su valor por defecto vía `normalize` y se mueve después desde el listado o al editar.
  En Pedidos-Cotización los cambios siguen `FLUJO_ESTADOS_COTIZACION`, así que el desplegable solo
  ofrece transiciones válidas y bloquea los estados finales.
- **Marcas** (`features/admin/generic/MarcasPage.jsx`): CRUD propio. La API de wheel-size quedó
  descartada — exige `user_key` de pago (responde 403) y cataloga marcas de vehículo, no de llanta.
- **Categorías**: color propio elegido con una paleta de 12 tonos con nombre más un cuentagotas para
  un color a medida. Ese color se refleja en el catálogo del cliente, en la pastilla de la
  miniatura y en el detalle del producto. Sin exportación.
- **Acceso denegado** (`features/auth/AccesoDenegadoPage.jsx`, ruta `/acceso-denegado`): pantalla
  403 con salidas para volver o cambiar de cuenta. El navbar del portal tiene un botón pequeño con
  candado para probarla.
- **Selectores de foráneas**: `components/base/SearchSelect` añade barra de búsqueda cuando el
  catálogo supera los 15 registros (`MINIMO_PARA_BUSCAR` en `Field.jsx`), y cuando un catálogo está
  vacío el campo muestra el aviso "No hay [dato] registrado, por favor registra al menos uno para
  poder continuar con el registro" en vez de un desplegable inútil.
- **Comprobante de venta**: botón de descarga (genera el documento en el navegador, sin backend) y
  el detalle de la cotización lista productos y servicios en la misma tabla.
- El formulario de "Agregar servicio" ya no pide el servicio: la empresa presta uno solo.

## 10. Siguientes pasos sugeridos (pendientes, no iniciados)

1. Revisar capturas/Figma de **Mobile** y adaptar layouts.
2. Si aparecen capturas de Figma de las páginas "genéricas" del Admin, rehacerlas a medida.
3. Conectar `mockData.js` a servicios REST reales según la arquitectura SOA documentada.
4. Implementar autenticación real en `LoginPage` (hoy solo navega).
5. Reemplazar `TireThumb` por fotos reales de producto.
6. Opcional: code-splitting por ruta para reducir el tamaño del bundle inicial.

## Rediseño de inputs, altas por listado y garantía como interruptor

- **`src/components/base/formStyles.js`** (nuevo) concentra el aspecto de los
  campos: caja `rounded-xl` con fondo propio, sombra suave, contorno que se
  aviva al pasar el cursor y halo ámbar al enfocar, en vez del input plano
  del navegador. Lo importan `Field`, `SearchSelect`, `DataTable`,
  `CardList`, `LoginPage`, `TotalCotizacion`, los selectores de cotizaciones
  y créditos y todos los modales armados a mano (`NuevoPedidoModal`,
  `NuevaOrdenCompraModal`, `NuevaEntregaModal`, `SolicitudCancelacionModal`,
  `EntregaModal`, `PedidoPanel`, `RegistrarAbonoModal`).
- **`Field`** estrena el tipo `switch`: guarda `'Sí'` / `'No'` y se pinta como
  interruptor verde. Lo usa la garantía de la orden de reencauche.
- **"Nuevo pedido-cotización"** ya no pide el estado; la cotización nace en
  `Pendiente`.
- **`SelectorPedidos`** acepta `filtro` y `vacioLabel` para acotar qué
  cotizaciones ofrece. **`SelectorCreditos`** (nuevo) hace lo mismo con los
  créditos: buscador y selección única.
- **`NuevoCreditoModal`** (nuevo) financia una cotización finalizada elegida
  del listado; el cliente sale de la propia cotización, y la fecha límite se
  calcula con el plazo (30/60/90 días).
- **`NuevoAbonoModal`** (nuevo) elige el crédito de un listado con buscador y
  solo pide monto y método de pago: la fecha es la de hoy y el saldo se
  calcula y se muestra ya resuelto.

## Campos numéricos, perfil desplegable y acceso al portal

- **`formStyles.js`** suma `soloDigitos`, `formatoMiles` y `soloTelefono`.
  `Field` los aplica mientras se escribe en los tipos `money`, `number` y
  `tel` (que se renderizan como `type="text"` con `inputMode="numeric"` para
  poder filtrar), y los modales armados a mano hacen lo propio con sus
  importes y cantidades: en ningún campo numérico entran letras.
- **`NuevoAbonoModal`** recorta el monto al saldo del crédito en cuanto se
  escribe uno mayor, y avisa de que lo ajustó; también recalcula el recorte
  si se cambia de crédito después de teclear el monto.
- **`PerfilMenu`** (nuevo) sustituye al modal que abría el avatar: despliega
  una tarjeta anclada con el detalle inicial de la ficha y los botones
  "Cerrar" y "Editar" —este último sí abre el `FormModal`—. Lo usan el
  topbar del administrador y el navbar del cliente.
- **`AdminSidebar`** incluye "Portal del cliente" justo encima de "Salir",
  para que el administrador pueda entrar al módulo de clientes.

## Rediseño completo sobre el modelo relacional y la ficha actualizada

El proyecto se realineó con el modelo entidad-relación de 14 tablas, la
ficha de proyecto actualizada y el diagrama de casos de uso.

**Modelo de datos.** `mockData.js` se reescribió entero: las entidades y sus
claves siguen el nombre de las columnas (`nombreRazonSocial`,
`numeroDocumento`, `saldoPendiente`, `precioVenta`, `estadoEntrega`...). Los
catálogos que en el modelo guardan el estado como `TINYINT(1)` usan el
interruptor Activo/Inactivo; venta y compra, que lo guardan como texto,
tienen su propio flujo de estados.

**Módulos del administrador** (16): Dashboard; Roles y permisos, Usuarios;
Productos, Categorías, Marcas, Servicios; Clientes, Proveedores, Terceros;
Pedidos-Cotización, Ventas, Compras, Solicitudes de servicio; Créditos,
Solicitudes de crédito, Abonos.

**Portal del cliente**: Inicio, Catálogo (con precios y stock),
Mis Cotizaciones-Pedido y Mi Cartera (créditos, abonos y solicitud de
crédito).

**Decisiones tomadas con el cliente del proyecto:**

- La cotización-pedido se conserva y convive con Venta: la venta se genera
  cuando la cotización llega a "Completada".
- Roles, permisos y usuarios se mantienen aunque el modelo no los incluya,
  porque son el primer objetivo de la ficha.
- El módulo de entregas desapareció. El estado de entrega vive ahora dentro
  de la cotización-pedido (despacho al cliente) y de la compra (recepción
  del proveedor), con el flujo secuencial pendiente → en camino → entregado
  y la posibilidad de cancelar antes de entregar.
- Los productos muestran código, stock, precio de compra y precio de venta,
  y el precio de venta también se ve en el catálogo del cliente.

**Financiación.** La ficha exige interés por plazo y una cuota inicial del
50%: `INTERES_POR_PLAZO` (3/6/9% a 30/60/90 días) y `CUOTA_INICIAL_CREDITO`
alimentan tanto el carrito del cliente como la cotización del asesor, y
ambos llegan al mismo total.

**Piezas nuevas o reescritas:** `SelectorCotizaciones`, `SelectorCreditos`,
`EstadoEntrega`, `DetalleCotizacionModal`, `NuevaCompraModal`,
`SolicitarCreditoModal`, `CarteraPage`, `ServiciosPage`, `ClientesPage`,
`VentasPage`, `SolicitudesServicioPage`, `SolicitudesCreditoPage`.
Se eliminaron `EntregasPage`, `NuevaEntregaModal`,
`SolicitudCancelacionModal`, `EntregasContext`, `EntregaModal`,
`OrdenesCompraPage`, `NuevaOrdenCompraModal`, `ReencauchePage`,
`SelectorPedidos` y `NuevoPedidoPage`.

## Ajustes de operación: anulaciones, comprobantes de abono y cuota inicial

- **`DataTable`** gana `canView` / `canEdit` / `canDelete` para ocultar cada
  acción de la fila, `formValidate` para las reglas que miran varios campos
  a la vez, y concordancia de género en los títulos ("Nueva venta", no
  "Nuevo venta"). `rowActions` ahora recibe `update(patch)` para modificar
  su propia fila.
- **`FormModal`** acepta `validate(values)`.
- **Módulo de servicios eliminado**: el catálogo `servicios` sigue en los
  datos porque alimenta las líneas de servicio, pero ya no tiene pantalla.
- **Roles y Usuarios** dejan de cambiar el estado desde el listado.
  **Categorías** pierde además el ver detalle y el eliminar.
- **Proveedores** filtra por nombre o razón social.
- **Ventas**: proveedor, estado de entrega editable y botón de anular con
  confirmación. La cuota inicial no puede bajar del 50% del total.
- **Compras**: botón de anular con confirmación (la orden anulada cancela
  también su entrega); una compra recibida ya no se anula ni se borra.
- **Cotización-pedido**: se asocia proveedor y queda un único "ver detalle",
  el integrado. La primera cuota se puede ajustar, con el mismo mínimo.
- **Cartera** (antes Créditos): sin editar ni eliminar, y con un botón por
  crédito que abre el historial de abonos, permite subir uno nuevo y
  descargar el comprobante de los confirmados. `AbonosAdminContext`
  comparte la lista entre la cartera y el listado de Abonos.
- **Abonos**: `ComprobanteAbonoModal` para los confirmados y carga
  obligatoria del pantallazo al registrarlos (salvo en efectivo).
- **Portal**: una cotización a crédito solo se envía tras registrar el abono
  de la cuota inicial —mínimo el 50%, con su comprobante—, que aparece
  luego en el aviso de envío.

## Acceso, animaciones y crédito único

- **Login**: valida con avisos propios (`noValidate`, nada de globos del
  navegador) y suma los formularios de **crear cuenta** y **¿olvidaste tu
  contraseña?**, ambos con validación cruzada —correo con formato, mínimo
  de caracteres y contraseñas que coincidan—.
- **`SplashScreen`**: pantalla de carga que solo aparece al iniciar sesión,
  con la llanta girando y una barra que se llena antes de entrar al panel.
- **Animaciones**: `ml-aparece` (entrada de una pieza), `ml-vista` (cambio
  de módulo), `ml-tarjeta` (realce al pasar el cursor) y `ml-pulsable`
  (el botón cede al pulsarlo). Todo se anula con `prefers-reduced-motion`.
- Roles, Usuarios y Categorías pierden la columna de estado.
- **Nueva venta** suma el comprobante de pago.
- El carrito del catálogo tiene **scroll propio** (`overscroll-contain`), así
  que el catálogo no se mueve mientras el cursor está sobre la cotización.
- En el detalle, el botón de menos **saca la línea** cuando ya solo queda
  una unidad; la papelera sigue estando.
- "Abonar la cuota inicial" muestra siempre el cuadro del comprobante,
  obligatorio salvo en efectivo.
- Los KPIs del dashboard vuelven a ser *Ventas del mes* y *Pedidos activos*.
- **Cartera**: el cliente solo puede tener **un crédito a la vez**. Mientras
  esté abierto, el saldo usable se muestra en negativo por el total de la
  cotización financiada, en rojo en el navbar, en la cartera y en el
  carrito, y no se puede pedir otro crédito ni abonar una cuota inicial
  nueva.

## Dos cuentas de cliente para pruebas

El portal trabaja con un cliente en sesión (`SesionContext`), que el login
elige y `localStorage` recuerda para que aguante una recarga. Hay dos
cuentas de prueba en `clientesDemo`:

- **maria@gmail.com** — cartera con el crédito CRE-002 abierto: saldo usable
  en negativo, sin poder pedir otro crédito.
- **lfmora@yahoo.com** — Luis Fernando Mora (CLI006), sin créditos, abonos
  ni solicitudes: cupo completo de $ 2.000.000 y crédito disponible. Sus
  tres cotizaciones son todas de contado.

`CreditoProvider` y `AbonosProvider` reciben los datos de la cuenta activa
y se remontan con `key` al cambiar de cliente, así que el saldo nunca se
arrastra de una cuenta a otra.

## Orden de compra a partir de la cotización, y tableros como antes

- **`NuevaCompraModal`**: al elegir la cotización de origen, sus líneas de
  producto pasan directamente al detalle de la compra (los servicios no,
  porque los ejecuta un tercero). El asesor puede sumar productos extra del
  catálogo; cada línea se marca como "Cotización" o "Adicional", y ese
  origen queda guardado en el detalle de la compra.
- **Dashboard del administrador**: vuelve a su forma anterior —dos
  indicadores, reencauches por mes, ventas por marca y "Últimos Pedidos"—.
  Se retiran los filtros por periodo y categoría, el botón de exportar, la
  gráfica de reporte de ventas y el ranking de productos.
- **Inicio del portal**: vuelven los indicadores de siempre (Mis
  Pedidos-Cotización, Próxima entrega, Mi crédito, Total comprado) más el
  saldo usable, y el bloque "Mis Pedidos-Cotización Recientes".
- Los códigos de la cotización-pedido vuelven al prefijo **PED-**, que es el
  que usa el módulo en pantalla.

## Detalle del abono y resumen de la cartera

- **Detalle del abono** (`src/features/portal/DetalleAbonoModal.jsx`): en Mi
  cartera cada abono del historial es pulsable y abre su detalle con el
  monto, el estado de la validación y el comprobante a la vista. Los abonos
  por transferencia traen un pantallazo de ejemplo (`comprobanteDemo` en
  `mockData.js`), porque sin backend no hay archivos subidos; los pagos en
  efectivo o con tarjeta muestran un aviso en lugar de la imagen.
- **Saldo usable** (`src/components/layout/SaldoUsableMenu.jsx`): el chip del
  navbar del cliente pasa a ser un desplegable con el resumen mínimo de la
  cartera —saldo, crédito abierto, monto financiado y saldo pendiente— y un
  botón "Ver más" que lleva a `/portal/cartera`.
- El **detalle de la cotización-pedido** ya no repite el bloque de
  financiación: esas condiciones viven en la cartera.

## Botones "Productos" y "Servicios" en el detalle de la cotización

En "Nueva cotización-pedido", el header de la tabla "Detalle de la
cotización" tiene ahora dos botones de tres puntos al lado izquierdo:

- **Productos** abre `SelectorProductosModal.jsx`
  (`src/features/admin/shared/`), con todos los productos del sistema, el
  mismo buscador y los mismos filtros del catálogo del portal (marca, tipo
  de vehículo, medida, categoría). Agregar no cierra el modal, para poder
  sumar varios productos seguidos; "Listo" lo cierra.
- **Servicios** abre el mismo formulario de servicio que ya existía
  (antes con el texto "Agregar servicio"), sin cambios en su contenido.

La sección "Productos del catálogo" que ya estaba arriba del detalle no se
tocó.

Se quitó la sección "Productos del catálogo" que estaba encima del detalle
en "Nueva cotización-pedido": ahora los productos solo se agregan desde el
botón "Productos" descrito arriba, sin duplicar el listado en el formulario.
