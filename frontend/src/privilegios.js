// =========================================================================
// Nivel 3 de seguridad: acciones de cada módulo.
//
// Es el mismo catálogo de la API (backend/src/privilegios.js). Un rol tiene
// módulos y, en cada uno, puede tener negadas algunas acciones; lo que no
// está negado está permitido. Ver el listado es tener el módulo.
// =========================================================================

/** Acciones que tienen todos los módulos (además de ver). */
export const ACCIONES_COMUNES = ['verDetalle', 'crear', 'editar', 'cambiarEstado', 'eliminar', 'exportar'];

/** Acciones propias de cada módulo. */
export const ACCIONES_PROPIAS = {
  'Pedidos-Cotización': ['emitir', 'aceptar', 'revisarPago', 'pagarCuota', 'descargarPdf'],
  Ventas: ['anular', 'descargarPdf'],
  Compras: ['anular'],
  'Solicitudes de servicio': ['revisarCarcasa', 'asignarPrecio', 'revisarPago'],
  Cartera: ['registrarAbono', 'aprobarCredito'],
  Abonos: ['confirmarAbono', 'descargarPdf'],
};

/** Nombre de cada acción en pantalla. */
export const NOMBRE_ACCION = {
  verDetalle: 'Ver detalle',
  crear: 'Crear',
  editar: 'Editar',
  cambiarEstado: 'Cambiar estado',
  eliminar: 'Eliminar',
  exportar: 'Exportar',
  emitir: 'Emitir cotización',
  aceptar: 'Aceptar por el cliente',
  revisarPago: 'Revisar pagos',
  pagarCuota: 'Registrar cuota inicial',
  descargarPdf: 'Descargar PDF',
  anular: 'Anular',
  revisarCarcasa: 'Revisar carcasa',
  asignarPrecio: 'Asignar precio',
  registrarAbono: 'Registrar abonos',
  aprobarCredito: 'Aprobar o rechazar crédito',
  confirmarAbono: 'Confirmar o rechazar abonos',
};

/** Módulos que solo se consultan: no tienen acciones que negar. */
export const MODULOS_SOLO_VER = ['Dashboard', 'Catálogo (portal)', 'Mis cotizaciones', 'Mi cartera'];

/** Acciones que se pueden negar en un módulo. */
export const accionesDe = (modulo) =>
  MODULOS_SOLO_VER.includes(modulo) ? [] : [...ACCIONES_COMUNES, ...(ACCIONES_PROPIAS[modulo] ?? [])];
