import { useState } from 'react';
import { Ban } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import { estadosCompra, estadosEntrega, FLUJO_ESTADOS_COMPRA } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { comprasService } from '../../../services';
import EstadoEntrega from '../shared/EstadoEntrega';
import NuevaCompraModal from './NuevaCompraModal';

// Tabla `compra` (+ `compra_detalle`). Cada compra abastece las llantas de
// una cotización aprobada (sale sola cuando el cliente paga). La recepción
// se sigue con `estadoEntrega`: solo con la entrega completada ("Entregado")
// la compra pasa a "Recibida".
const columns = [
  { key: 'id', label: 'Nº Compra' },
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
        onCreate={(datos) => compras.crear(datos)}
        onEdit={compras.editar}
        // El detalle se edita solo con la compra y su entrega pendientes
        canEdit={(row) => row.estado === 'Pendiente' && row.estadoEntrega === 'Pendiente'}
        motivoNoEditable={(row) =>
          row.estado !== 'Pendiente' ? `La compra está "${row.estado}"` : `La entrega está "${row.estadoEntrega}"`
        }
        editModal={({ row, onSubmit, onClose }) => <NuevaCompraModal compra={row} onSubmit={onSubmit} onClose={onClose} />}
        onStatusChange={(fila, estado) => compras.ejecutar(() => comprasService.cambiarEstado(fila, estado))}
        onRowUpdate={(fila, cambios) => compras.ejecutar(() => comprasService.actualizar(fila, cambios))}
        // Se recibe solo con la entrega completada (la API también lo exige)
        canChangeStatus={(row) => row.estado !== 'Pendiente' || row.estadoEntrega === 'Entregado'}
        statusKey="estado"
        newLabel="Nueva compra"
        formSections={formSections}
        entityName="compra"
        titleKey="id"
        statusOptions={estadosCompra}
        statusFlow={FLUJO_ESTADOS_COMPRA}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosCompra },
          { key: 'estadoEntrega', label: 'Entrega', options: estadosEntrega },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevaCompraModal onSubmit={onSubmit} onClose={onClose} />}
        canDelete={false}
        rowActions={(row, { update }) => (
          // Una compra recibida no se toca; una pendiente se puede anular
          <BotonAccion
            icono={Ban}
            etiqueta="Anular la orden de compra"
            tono="peligro"
            deshabilitado={row.estado !== 'Pendiente'}
            motivo={`La compra está "${row.estado}"`}
            onClick={() => setAnulando({ row, update })}
          />
        )}
      />

      {anulando && (
        <ConfirmDialog
          title="¿Anular la orden de compra?"
          message="La orden queda anulada y no se enviará al proveedor."
          confirmLabel="Anular orden"
          record={{ title: anulando.row.id, subtitle: `${anulando.row.cotizacion || 'Compra directa'} · ${anulando.row.total}` }}
          // La API cancela también la entrega pendiente
          onConfirm={() => anulando.update({ estado: 'Anulada' })}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
