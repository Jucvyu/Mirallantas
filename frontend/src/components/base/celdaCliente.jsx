/**
 * Celda de "Cliente" para las tablas: el nombre y, debajo, su documento
 * (tipo y número) en letra pequeña, para distinguir dos nombres parecidos.
 * Los listados que traen `clienteDocumento` lo muestran; los que no, solo
 * el nombre.
 *
 *   const columns = [columnaCliente(), …];
 *   // o con otra llave para el nombre:
 *   columnaCliente({ key: 'cliente', label: 'Cliente' })
 */
export function celdaCliente(row, campoNombre = 'cliente') {
  const nombre = row[campoNombre];
  const documento = row.clienteDocumento
    ? `${row.clienteTipoDocumento ?? ''} ${row.clienteDocumento}`.trim()
    : '';
  return (
    <span className="min-w-0">
      <span className="block truncate">{nombre}</span>
      {documento && (
        <span className="block truncate text-[11px] font-normal text-slate-400">{documento}</span>
      )}
    </span>
  );
}

/** Columna de cliente lista para `DataTable`. */
export function columnaCliente({ key = 'cliente', label = 'Cliente' } = {}) {
  return { key, label, render: (row) => celdaCliente(row, key) };
}
