import { useState } from 'react';
import { Ban } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import { estadosCompra, estadosEntrega, FLUJO_ESTADOS_COMPRA } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { comprasService } from '../../../services';
import EstadoEntrega from '../shared/EstadoEntrega';
import NuevaCompraModal from './NuevaCompraModal';

// Tabla `compra` (+ `compra_detalle`). Cada compra abastece una cotización
// aprobada. La recepción de la mercancía se sigue con `estadoEntrega`.
const columns = [
  { key: 'id', label: 'Nº Compra' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'cotizacion', label: 'Cotización', render: (row) => row.cotizacion || 'Compra directa' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'total', label: 'Total' },
  { key: 'estado', label: 'Estado' },
  {
    key: 'estadoEntrega',
    label: 'Entrega',
    render: (row, { update }) => <EstadoEntrega row={row} update={update} />,
  },
];

// La creación usa NuevaCompraModal. Después de creada, una compra solo
// cambia de estado (recibirla o anularla) y de entrega: el resto se consulta.
const formSections = [
  {
    title: 'Datos de la compra',
    fields: [
      { key: 'proveedor', label: 'Proveedor', soloLectura: true },
      { key: 'cotizacion', label: 'Cotización de origen', soloLectura: true },
      { key: 'fecha', label: 'Fecha', soloLectura: true },
      { key: 'total', label: 'Valor total (COP)', soloLectura: true },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosCompra, only: ['edit', 'view'] },
      { key: 'estadoEntrega', label: 'Estado de la entrega', type: 'select', options: estadosEntrega, only: ['edit', 'view'] },
    ],
  },
];

export default function ComprasPage() {
  // Compra que se va a anular, a la espera de la confirmación
  const [anulando, setAnulando] = useState(null);
  const compras = useRecurso(comprasService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Compras']} />
      <DataTable
        title="Compras"
        columns={columns}
        data={compras.filas}
        cargando={compras.cargando}
        error={compras.error}
        onRecargar={compras.recargar}
        // NuevaCompraModal entrega los datos del formulario y la lista de proveedores
        onCreate={(datos, contexto) => compras.crear(datos, contexto)}
        onEdit={compras.editar}
        onStatusChange={(fila, estado) => compras.ejecutar(() => comprasService.cambiarEstado(fila, estado))}
        onRowUpdate={(fila, cambios) => compras.ejecutar(() => comprasService.actualizar(fila, cambios))}
        statusKey="estado"
        newLabel="Nueva compra"
        formSections={formSections}
        entityName="compra"
        titleKey="proveedor"
        statusOptions={estadosCompra}
        statusFlow={FLUJO_ESTADOS_COMPRA}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosCompra },
          { key: 'estadoEntrega', label: 'Entrega', options: estadosEntrega },
          { key: 'proveedor', label: 'Proveedor' },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevaCompraModal onSubmit={onSubmit} onClose={onClose} />}
        canDelete={false}
        rowActions={(row, { update }) =>
          // Una compra recibida no se toca; una pendiente se puede anular
          row.estado === 'Pendiente' ? (
            <button
              onClick={() => setAnulando({ row, update })}
              className="rounded p-1 text-red-500 hover:text-red-600"
              aria-label={`Anular ${row.id}`}
              title="Anular la orden de compra"
            >
              <Ban size={15} />
            </button>
          ) : null
        }
      />

      {anulando && (
        <ConfirmDialog
          title="¿Anular la orden de compra?"
          message="La orden queda anulada y no se enviará al proveedor."
          confirmLabel="Anular orden"
          record={{ title: anulando.row.id, subtitle: `${anulando.row.proveedor} · ${anulando.row.total}` }}
          // La API cancela también la entrega pendiente
          onConfirm={() => anulando.update({ estado: 'Anulada' })}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
