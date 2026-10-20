// =========================================================================
// Opciones de los buscadores (SearchSelect) a partir de las filas de la API.
//
// Cada opción guarda el id real del registro y muestra el documento y el
// teléfono para distinguir dos clientes o proveedores con nombres parecidos.
// Solo se ofrecen los activos: la API rechaza los inactivos de todos modos.
// =========================================================================

const detalleContacto = (f) =>
  [f.numeroDocumento ? `${f.tipoDocumento ?? ''} ${f.numeroDocumento}`.trim() : null, f.telefono]
    .filter(Boolean)
    .join(' · ');

/** Clientes activos → [{ valor: id, etiqueta: nombre, detalle: 'CC 123 · 300…' }] */
export const opcionesClientes = (filas = []) =>
  filas
    .filter((c) => c.activo !== false)
    .map((c) => ({ valor: c.id, etiqueta: c.nombreCompleto, detalle: detalleContacto(c) }));

/** Proveedores o terceros activos → [{ valor: id, etiqueta: razón social, detalle }] */
export const opcionesEmpresas = (filas = []) =>
  filas
    .filter((p) => p.activo !== false)
    .map((p) => ({ valor: p.id, etiqueta: p.nombreRazonSocial, detalle: detalleContacto(p) }));
