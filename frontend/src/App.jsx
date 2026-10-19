import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RutaProtegida, { ConPermiso } from './components/base/RutaProtegida';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LandingPage from './features/landing/LandingPage';
import LoginPage from './features/auth/LoginPage';
import CuentaInactivaPage from './features/auth/CuentaInactivaPage';
import AccesoDenegadoPage from './features/auth/AccesoDenegadoPage';

import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './features/admin/dashboard/DashboardPage';
import RolesPage from './features/admin/roles/RolesPage';
import UsuariosPage from './features/admin/usuarios/UsuariosPage';
import ClientesPage from './features/admin/clientes/ClientesPage';
import ProveedoresPage from './features/admin/proveedores/ProveedoresPage';
import TercerosPage from './features/admin/terceros/TercerosPage';
import ProductosPage from './features/admin/generic/ProductosPage';
import CategoriasPage from './features/admin/generic/CategoriasPage';
import MarcasPage from './features/admin/generic/MarcasPage';
import PedidosCotizacionPage from './features/admin/generic/PedidosCotizacionPage';
import VentasPage from './features/admin/generic/VentasPage';
import ComprasPage from './features/admin/generic/ComprasPage';
import SolicitudesServicioPage from './features/admin/generic/SolicitudesServicioPage';
import CreditosPage from './features/admin/generic/CreditosPage';
import SolicitudesCreditoPage from './features/admin/generic/SolicitudesCreditoPage';
import AbonosPage from './features/admin/generic/AbonosPage';

import ClientLayout from './components/layout/ClientLayout';
import ClientHomePage from './features/portal/ClientHomePage';
import CatalogoPage from './features/portal/CatalogoPage';
import ClientPedidosPage from './features/portal/ClientPedidosPage';
import CarteraPage from './features/portal/CarteraPage';

/**
 * Páginas del panel con el permiso que exige cada una. El nombre del
 * permiso es el mismo que guarda la base de datos (ver src/permisos.js).
 */
const PAGINAS_ADMIN = [
  { ruta: 'roles', permiso: 'Roles', pagina: <RolesPage /> },
  { ruta: 'usuarios', permiso: 'Usuarios', pagina: <UsuariosPage /> },
  { ruta: 'clientes', permiso: 'Clientes', pagina: <ClientesPage /> },
  { ruta: 'proveedores', permiso: 'Proveedores', pagina: <ProveedoresPage /> },
  { ruta: 'terceros', permiso: 'Terceros', pagina: <TercerosPage /> },
  { ruta: 'productos', permiso: 'Productos', pagina: <ProductosPage /> },
  { ruta: 'categorias', permiso: 'Categorías', pagina: <CategoriasPage /> },
  { ruta: 'marcas', permiso: 'Marcas', pagina: <MarcasPage /> },
  { ruta: 'pedidos-cotizacion', permiso: 'Pedidos-Cotización', pagina: <PedidosCotizacionPage /> },
  { ruta: 'ventas', permiso: 'Ventas', pagina: <VentasPage /> },
  { ruta: 'compras', permiso: 'Compras', pagina: <ComprasPage /> },
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
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
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
              <Route path="pedidos" element={<ConPermiso modulo="Mis cotizaciones"><ClientPedidosPage /></ConPermiso>} />
              <Route path="cartera" element={<ConPermiso modulo="Mi cartera"><CarteraPage /></ConPermiso>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
