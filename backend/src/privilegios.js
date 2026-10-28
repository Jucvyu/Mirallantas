/**
 * Nivel 3 de seguridad: acciones de cada módulo.
 *
 * Un rol tiene módulos (nivel 2) y, en cada módulo, puede tener negadas
 * algunas acciones (tabla rol_permiso.acciones_denegadas). Lo que no está
 * negado está permitido. El frontend tiene el mismo catálogo
 * (frontend/src/privilegios.js) para mostrar la matriz de roles y ocultar
 * los botones.
 */

/** Acciones que tienen todos los módulos (ver = tener el módulo; no se niega). */
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

/** Campos que solo cambian el estado o la entrega de un registro. */
const CAMPOS_DE_ESTADO = new Set(['estado', 'estadoEntrega', 'activo', 'motivo', 'motivoCancelacion']);

/**
 * Acción que pide la petición dentro de un módulo. `req.path` es la ruta
 * dentro del módulo (p. ej. '/PED-2026-001/emitir') y `req.baseUrl` el
 * módulo (p. ej. '/api/cotizaciones').
 */
export function accionDe(req) {
  const ruta = req.path.replace(/\/+$/, '') || '/';
  const partes = ruta.split('/').filter(Boolean);
  const final = partes.at(-1);
  const base = req.baseUrl;

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (final === 'pdf') return 'descargarPdf';
    // Listados y catálogos auxiliares (facturas, medidas, permisos)
    if (partes.length === 0 || ['facturas', 'medidas', 'permisos'].includes(partes[0])) return 'ver';
    return 'verDetalle';
  }
  if (req.method === 'DELETE') return 'eliminar';

  if (req.method === 'POST') {
    if (partes.length === 0) return 'crear';
    const propias = { emitir: 'emitir', aceptar: 'aceptar', cuota: 'pagarCuota', abonos: 'registrarAbono', pago: 'revisarPago' };
    return propias[final] ?? 'editar';
  }

  // PUT / PATCH
  if (final === 'estado') return 'cambiarEstado';
  const cuerpo = req.body ?? {};
  const campos = Object.keys(cuerpo);
  if (cuerpo.estado === 'Anulada') return 'anular';
  if (base.endsWith('/solicitudes-credito') && 'estado' in cuerpo) return 'aprobarCredito';
  if (base.endsWith('/abonos') && 'estado' in cuerpo) return 'confirmarAbono';
  if (base.endsWith('/solicitudes-servicio')) {
    if ('estadoEvidencia' in cuerpo) return 'revisarCarcasa';
    if ('precio' in cuerpo || 'costo' in cuerpo) return 'asignarPrecio';
  }
  if (campos.length > 0 && campos.every((c) => CAMPOS_DE_ESTADO.has(c))) return 'cambiarEstado';
  return 'editar';
}

/** Nombre de cada acción para los mensajes de error. */
export const NOMBRE_ACCION = {
  verDetalle: 'ver el detalle',
  crear: 'crear',
  editar: 'editar',
  cambiarEstado: 'cambiar el estado',
  eliminar: 'eliminar',
  exportar: 'exportar',
  emitir: 'emitir cotizaciones',
  aceptar: 'aceptar cotizaciones por el cliente',
  revisarPago: 'revisar pagos',
  pagarCuota: 'registrar la cuota inicial',
  descargarPdf: 'descargar el PDF',
  anular: 'anular',
  revisarCarcasa: 'revisar la carcasa',
  asignarPrecio: 'asignar precios',
  registrarAbono: 'registrar abonos',
  aprobarCredito: 'aprobar o rechazar créditos',
  confirmarAbono: 'confirmar o rechazar abonos',
};

/** Acciones que existen en un módulo (para validar lo que guarda un rol). */
export const accionesDe = (modulo) => [...ACCIONES_COMUNES, ...(ACCIONES_PROPIAS[modulo] ?? [])];
