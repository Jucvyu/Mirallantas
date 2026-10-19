// =========================================================================
// Módulos del panel administrativo y el permiso que exige cada uno.
//
// El nombre del permiso es el mismo que guarda la base de datos (tabla
// `permiso`). Lo usan el menú lateral (para mostrar solo lo permitido),
// las rutas (para bloquear el acceso directo por URL) y el login (para
// saber a qué pantalla enviar a cada usuario).
// =========================================================================

export const MODULOS_ADMIN = [
  { ruta: '/admin', permiso: 'Dashboard' },
  { ruta: '/admin/roles', permiso: 'Roles' },
  { ruta: '/admin/usuarios', permiso: 'Usuarios' },
  { ruta: '/admin/productos', permiso: 'Productos' },
  { ruta: '/admin/categorias', permiso: 'Categorías' },
  { ruta: '/admin/marcas', permiso: 'Marcas' },
  { ruta: '/admin/clientes', permiso: 'Clientes' },
  { ruta: '/admin/proveedores', permiso: 'Proveedores' },
  { ruta: '/admin/terceros', permiso: 'Terceros' },
  { ruta: '/admin/pedidos-cotizacion', permiso: 'Pedidos-Cotización' },
  { ruta: '/admin/ventas', permiso: 'Ventas' },
  { ruta: '/admin/compras', permiso: 'Compras' },
  { ruta: '/admin/solicitudes-servicio', permiso: 'Solicitudes de servicio' },
  { ruta: '/admin/creditos', permiso: 'Cartera' },
  { ruta: '/admin/solicitudes-credito', permiso: 'Cartera' },
  { ruta: '/admin/abonos', permiso: 'Abonos' },
];

/**
 * Pantallas de la vista de cliente (portal) y el permiso de cada una. El
 * Cliente y el Administrador los tienen; a un rol del personal se le dan
 * si debe poder mirar el portal (solo así ve el botón "Portal del cliente").
 */
export const MODULOS_PORTAL = [
  { ruta: '/portal/catalogo', permiso: 'Catálogo (portal)' },
  { ruta: '/portal/pedidos', permiso: 'Mis cotizaciones' },
  { ruta: '/portal/cartera', permiso: 'Mi cartera' },
];

/**
 * Módulos agrupados por categoría, como en el menú lateral. Los usa el
 * formulario de roles para mostrar los permisos ordenados.
 */
export const GRUPOS_MODULOS = [
  { titulo: 'Configuración', opciones: ['Roles', 'Usuarios'] },
  { titulo: 'Catálogo', opciones: ['Productos', 'Categorías', 'Marcas'] },
  { titulo: 'Usuarios externos', opciones: ['Clientes', 'Proveedores', 'Terceros'] },
  { titulo: 'Operación', opciones: ['Pedidos-Cotización', 'Ventas', 'Compras', 'Solicitudes de servicio'] },
  { titulo: 'Cartera', opciones: ['Cartera', 'Abonos'] },
  { titulo: 'General', opciones: ['Dashboard'] },
  { titulo: 'Vista de cliente', opciones: MODULOS_PORTAL.map((m) => m.permiso) },
];

/**
 * Módulos que, además del permiso, exigen el rol Administrador (la API
 * también lo exige): quien maneja roles y usuarios controla el sistema.
 */
export const MODULOS_SOLO_ADMIN = ['Roles', 'Usuarios'];

/** Permiso que exige una ruta del panel o del portal (o undefined si no exige ninguno). */
export function permisoDeRuta(ruta) {
  return [...MODULOS_ADMIN, ...MODULOS_PORTAL].find((m) => m.ruta === ruta)?.permiso;
}

/** ¿El usuario tiene el permiso? (Roles y Usuarios exigen además ser Administrador) */
export function permite(usuario, permiso) {
  return (
    Boolean(usuario?.permisos?.includes(permiso)) &&
    (!MODULOS_SOLO_ADMIN.includes(permiso) || usuario.rol === 'Administrador')
  );
}

/** ¿El usuario tiene alguna pantalla de la vista de cliente? */
export function veElPortal(usuario) {
  return MODULOS_PORTAL.some((m) => permite(usuario, m.permiso));
}

/**
 * ¿El usuario puede abrir esta ruta? Lo usa el login para no llevar a
 * alguien a la última página que abrió otra persona en este navegador.
 */
export function puedeAbrir(usuario, ruta) {
  const permiso = permisoDeRuta(ruta);
  if (ruta.startsWith('/admin')) {
    return !usuario.clienteId && Boolean(permiso) && permite(usuario, permiso);
  }
  if (ruta.startsWith('/portal')) {
    if (permiso) return permite(usuario, permiso);
    return Boolean(usuario.clienteId) || veElPortal(usuario);
  }
  return false;
}

/**
 * Primer módulo del panel administrativo que el usuario puede abrir, o
 * undefined si no tiene ninguno (o si es un cliente del portal).
 */
export function primerModuloAdmin(usuario) {
  if (!usuario || usuario.clienteId || usuario.rol === 'Cliente') return undefined;
  return MODULOS_ADMIN.find((m) => permite(usuario, m.permiso))?.ruta;
}

/**
 * Pantalla a la que se envía a un usuario al iniciar sesión:
 *   - un cliente va a su portal;
 *   - el personal va al primer módulo del panel que tenga permitido;
 *   - si no tiene ninguno pero sí pantallas del portal, al portal.
 */
export function pantallaInicial(usuario) {
  if (usuario.clienteId) return '/portal';
  return primerModuloAdmin(usuario) ?? (veElPortal(usuario) ? '/portal' : '/acceso-denegado');
}
