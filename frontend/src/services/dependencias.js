// =========================================================================
// Dependencias entre recursos para el tiempo real (sin imports: lo usa
// también la prueba de saturación del backend, test/saturacion.test.js).
// =========================================================================

/**
 * Qué recursos se afectan entre sí. Un listado de cotizaciones muestra
 * nombres de productos y clientes; el de productos muestra si una llanta
 * reencauchada quedó apartada por una cotización. Lo que no está aquí (la
 * configuración de la empresa, los catálogos del sistema) afecta a todo.
 */
const GRUPO = {
  roles: 'seguridad',
  usuarios: 'seguridad',
  categorias: 'catalogo',
  marcas: 'catalogo',
  'tipos-vehiculo': 'catalogo',
  servicios: 'catalogo',
  productos: 'catalogo',
  modelos: 'catalogo',
  bandas: 'catalogo',
  clientes: 'contactos',
  proveedores: 'contactos',
  terceros: 'contactos',
  seleccion: 'contactos',
  cotizaciones: 'comercial',
  ventas: 'comercial',
  compras: 'comercial',
  creditos: 'comercial',
  abonos: 'comercial',
  'solicitudes-credito': 'comercial',
  'solicitudes-servicio': 'comercial',
  reencauches: 'comercial',
  portal: 'comercial',
};
const DEPENDE_DE = {
  seguridad: ['seguridad'],
  catalogo: ['catalogo', 'comercial'],
  contactos: ['contactos', 'comercial'],
  comercial: ['comercial', 'catalogo', 'contactos'],
};

/**
 * ¿Los `cambiados` afectan a una pantalla que muestra `mira`? Sin `mira`
 * (o con '*') la pantalla depende de todo.
 */
export function afecta(cambiados = [], mira) {
  if (!mira?.length || mira.includes('*') || cambiados.includes('*')) return true;
  const grupos = new Set(mira.flatMap((r) => DEPENDE_DE[GRUPO[r]] ?? ['*']));
  if (grupos.has('*')) return true;
  return cambiados.some((r) => !GRUPO[r] || grupos.has(GRUPO[r]));
}
