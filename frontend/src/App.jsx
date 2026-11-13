import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RutaProtegida, { ConPermiso } from './components/base/RutaProtegida';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LandingPage from './features/landing/LandingPage';
import LoginPage from './features/auth/LoginPage';
import CuentaInactivaPage from './features/auth/CuentaInactivaPage';
import AccesoDenegadoPage from './features/auth/AccesoDenegadoPage';
import NoEncontradaPage from './features/auth/NoEncontradaPage';
import AvisosDeConexion from './components/estado/AvisosDeConexion';
import LimiteDeErrores from './components/estado/LimiteDeErrores';

// Cada pantalla del panel y del portal se descarga al abrirla por primera
// vez (así la página de inicio y el login cargan mucho más rápido).
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const DashboardPage = lazy(() => import('./features/admin/dashboard/DashboardPage'));
const RolesPage = lazy(() => import('./features/admin/roles/RolesPage'));
const UsuariosPage = lazy(() => import('./features/admin/usuarios/UsuariosPage'));
const ProveedoresPage = lazy(() => import('./features/admin/proveedores/ProveedoresPage'));
const TercerosPage = lazy(() => import('./features/admin/terceros/TercerosPage'));
const ProductosPage = lazy(() => import('./features/admin/generic/ProductosPage'));
const ProductoAdminPage = lazy(() => import('./features/admin/productos/ProductoAdminPage'));
const CategoriasPage = lazy(() => import('./features/admin/generic/CategoriasPage'));
const MarcasPage = lazy(() => import('./features/admin/generic/MarcasPage'));
const PedidosCotizacionPage = lazy(() => import('./features/admin/generic/PedidosCotizacionPage'));
const VentasPage = lazy(() => import('./features/admin/generic/VentasPage'));
const ComprasPage = lazy(() => import('./features/admin/generic/ComprasPage'));
const SolicitudesServicioPage = lazy(() => import('./features/admin/generic/SolicitudesServicioPage'));
// Reencauche por banda
const BandasPage = lazy(() => import('./features/reencauche/admin/BandasPage'));
const RevisionesPage = lazy(() => import('./features/reencauche/admin/RevisionesPage'));
const ReencaucheDetallePage = lazy(() => import('./features/reencauche/admin/ReencaucheDetallePage'));
const OrdenesReencauchePage = lazy(() => import('./features/reencauche/admin/OrdenesReencauchePage'));
const ReencauchePortalPage = lazy(() => import('./features/reencauche/portal/ReencauchePortalPage'));
const CreditosPage = lazy(() => import('./features/admin/generic/CreditosPage'));
const SolicitudesCreditoPage = lazy(() => import('./features/admin/generic/SolicitudesCreditoPage'));
const AbonosPage = lazy(() => import('./features/admin/generic/AbonosPage'));
const ClientLayout = lazy(() => import('./components/layout/ClientLayout'));
const ClientHomePage = lazy(() => import('./features/portal/ClientHomePage'));
const CatalogoPage = lazy(() => import('./features/portal/CatalogoPage'));
const CatalogoPublicoPage = lazy(() => import('./features/landing/CatalogoPublicoPage'));
const LicenciasPage = lazy(() => import('./features/legal/LicenciasPage'));
const LicenciasPanelPage = lazy(() => import('./features/legal/LicenciasPanelPage'));
const DetalleProductoPublicoPage = lazy(() => import('./features/landing/DetalleProductoPublicoPage'));
const DetalleProductoPage = lazy(() => import('./features/portal/DetalleProductoPage'));
const ClientPedidosPage = lazy(() => import('./features/portal/ClientPedidosPage'));
const CarteraPage = lazy(() => import('./features/portal/CarteraPage'));

/**
 * Páginas del panel con el permiso que exige cada una. El nombre del
 * permiso es el mismo que guarda la base de datos (ver src/permisos.js).
 */
const PAGINAS_ADMIN = [
  { ruta: 'roles', permiso: 'Roles', pagina: <RolesPage /> },
  { ruta: 'usuarios', permiso: 'Usuarios', pagina: <UsuariosPage /> },
  { ruta: 'proveedores', permiso: 'Proveedores', pagina: <ProveedoresPage /> },
  { ruta: 'terceros', permiso: 'Terceros', pagina: <TercerosPage /> },
  { ruta: 'productos', permiso: 'Productos', pagina: <ProductosPage /> },
  // Página de un producto: sus medidas, su ficha técnica y su foto
  { ruta: 'productos/:id', permiso: 'Productos', pagina: <ProductoAdminPage /> },
  { ruta: 'categorias', permiso: 'Categorías', pagina: <CategoriasPage /> },
  { ruta: 'marcas', permiso: 'Marcas', pagina: <MarcasPage /> },
  { ruta: 'pedidos-cotizacion', permiso: 'Pedidos-Cotización', pagina: <PedidosCotizacionPage /> },
  { ruta: 'ventas', permiso: 'Ventas', pagina: <VentasPage /> },
  { ruta: 'compras', permiso: 'Compras', pagina: <ComprasPage /> },
  // Reencauche por banda: revisiones (con su detalle), órdenes en la planta y bandas
  { ruta: 'reencauches', permiso: 'Reencauche', pagina: <RevisionesPage /> },
  { ruta: 'reencauches/:numero', permiso: 'Reencauche', pagina: <ReencaucheDetallePage /> },
  { ruta: 'ordenes-reencauche', permiso: 'Reencauche', pagina: <OrdenesReencauchePage /> },
  { ruta: 'bandas', permiso: 'Reencauche', pagina: <BandasPage /> },
  // Servicios del flujo anterior (con foto de la carcasa), para terminar los que quedaron a medias
  { ruta: 'solicitudes-servicio', permiso: 'Solicitudes de servicio', pagina: <SolicitudesServicioPage /> },
  { ruta: 'creditos', permiso: 'Cartera', pagina: <CreditosPage /> },
  { ruta: 'solicitudes-credito', permiso: 'Cartera', pagina: <SolicitudesCreditoPage /> },
  { ruta: 'abonos', permiso: 'Abonos', pagina: <AbonosPage /> },
];

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Sin internet o servidor caído: aviso encima de todo */}
          <AvisosDeConexion />
          {/* Un error al dibujar una pantalla muestra un aviso en vez de dejarla en blanco */}
          <LimiteDeErrores>
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/catalogo" element={<CatalogoPublicoPage />} />
            <Route path="/catalogo/:modeloId" element={<DetalleProductoPublicoPage />} />
            <Route path="/catalogo/unidad/:productoId" element={<DetalleProductoPublicoPage />} />
            <Route path="/licencias" element={<LicenciasPage />} />
            <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />
            <Route path="/cuenta-inactiva" element={<CuentaInactivaPage />} />

            {/* ---- Panel administrativo (solo personal con sesión) ---- */}
            <Route
              path="/admin"
              element={
                <RutaProtegida zona="admin">
                  <AdminLayout />
                </RutaProtegida>
              }
            >
              <Route
                index
                element={
                  <ConPermiso modulo="Dashboard">
                    <DashboardPage />
                  </ConPermiso>
                }
              />
              {PAGINAS_ADMIN.map(({ ruta, permiso, pagina }) => (
                <Route key={ruta} path={ruta} element={<ConPermiso modulo={permiso}>{pagina}</ConPermiso>} />
              ))}
              {/* Licencias del software: cualquier persona del panel puede verlas */}
              <Route path="licencias" element={<LicenciasPanelPage />} />
              <Route path="*" element={<NoEncontradaPage compacta inicio="/admin" />} />
            </Route>

            {/* ---- Portal del cliente (cada pantalla con su permiso) ---- */}
            <Route
              path="/portal"
              element={
                <RutaProtegida zona="portal">
                  <ClientLayout />
                </RutaProtegida>
              }
            >
              <Route index element={<ClientHomePage />} />
              <Route path="catalogo" element={<ConPermiso modulo="Catálogo (portal)"><CatalogoPage /></ConPermiso>} />
              <Route path="catalogo/:modeloId" element={<ConPermiso modulo="Catálogo (portal)"><DetalleProductoPage /></ConPermiso>} />
              <Route path="catalogo/unidad/:productoId" element={<ConPermiso modulo="Catálogo (portal)"><DetalleProductoPage /></ConPermiso>} />
              <Route path="pedidos" element={<ConPermiso modulo="Mis cotizaciones"><ClientPedidosPage /></ConPermiso>} />
              <Route path="cartera" element={<ConPermiso modulo="Mi cartera"><CarteraPage /></ConPermiso>} />
              <Route path="reencauche" element={<ConPermiso modulo="Mis reencauches"><ReencauchePortalPage /></ConPermiso>} />
              <Route path="*" element={<NoEncontradaPage compacta inicio="/portal" />} />
            </Route>
            {/* Cualquier otra dirección */}
            <Route path="*" element={<NoEncontradaPage />} />
          </Routes>
          </Suspense>
          </LimiteDeErrores>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
