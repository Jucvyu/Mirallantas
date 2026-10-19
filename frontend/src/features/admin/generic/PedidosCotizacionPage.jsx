import { useState } from 'react';
import { Eye, HandCoins, Receipt } from 'lucide-react';
import Badge from '../../../components/base/Badge';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import {
  estadosCotizacion,
  ESTADO_COTIZACION_COMPLETADA,
  FLUJO_ESTADOS_COTIZACION,
  estadosEntrega,
  ESTADOS_PAGO,
  metodosPago,
} from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { cotizacionesService, proveedoresService } from '../../../services';
import EstadoEntrega from '../shared/EstadoEntrega';
import NuevoPedidoModal from './NuevoPedidoModal';
import PagosCotizacionModal from './PagosCotizacionModal';
import ComprobanteVentaModal from '../../shared/ComprobanteVentaModal';
import DetalleCotizacionModal from '../../shared/DetalleCotizacionModal';

// Cotización-pedido: la solicitud que arma el cliente o el asesor. El total
// sale de los precios del catálogo; si es a crédito, se aprueba desde
// "Solicitudes de crédito". Al pasar a "Completada" la API genera la venta. El estado de
// entrega vive aquí, ya que el módulo de entregas se retiró.
//
// De contado, la cotización lleva la consignación del cliente: mientras está
// pendiente de confirmación la fila se resalta en amarillo y no se puede
// cambiar nada; si se desaprueba, queda atenuada hasta que el cliente suba
// otro pago. El asesor la revisa en "Ver pago".

/**
 * ¿El pago frena la cotización? Sigue en "Pendiente" hasta que todo esté
 * aprobado: la consignación (o la cuota inicial) y cada servicio.
 */
const bloqueada = (row) => Boolean(row.estadoPago) && row.estadoPago !== 'Aprobado';

const columns = [
  { key: 'id', label: 'Nº Cotización' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'metodoPago', label: 'Método de pago' },
  // Precio del catálogo × cantidad (más el interés si es a crédito) y el
  // valor de los servicios: lo calcula la API, nadie lo escribe a mano
  { key: 'total', label: 'Total' },
  {
    // Pendiente / Aprobado / Rechazado: la consignación de contado o, a
    // crédito, la solicitud que revisa la cuota inicial
    key: 'estadoPago',
    label: 'Estado de pago',
    render: (row) =>
      row.estadoPago ? <Badge>{row.estadoPago}</Badge> : <span className="text-xs text-slate-400">—</span>,
  },
  { key: 'estado', label: 'Estado' },
  {
    key: 'estadoEntrega',
    label: 'Entrega',
    // Con el pago sin aprobar, la entrega tampoco se mueve
    render: (row, { update }) => <EstadoEntrega row={row} update={bloqueada(row) ? undefined : update} />,
  },
];

/**
 * Formulario de edición y detalle (la creación usa NuevoPedidoModal).
 * Cliente, fecha y método de pago no cambian después de creada: de ellos
 * dependen los totales, así que solo se muestran.
 */
function seccionesFormulario(nombresProveedores) {
  return [
    {
      title: 'Datos de la cotización',
      fields: [
        { key: 'cliente', label: 'Cliente', soloLectura: true },
        { key: 'fecha', label: 'Fecha', soloLectura: true },
        { key: 'metodoPago', label: 'Método de pago', soloLectura: true },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosCotizacion, only: ['edit', 'view'] },
      ],
    },
    {
      title: 'Entrega',
      fields: [
        { key: 'direccionEntrega', label: 'Dirección de despacho', span: 2, required: true },
        { key: 'estadoEntrega', label: 'Estado de la entrega', type: 'select', options: estadosEntrega, only: ['edit', 'view'] },
        {
          key: 'motivoCancelacion',
          label: 'Motivo de la cancelación',
          type: 'textarea',
          span: 2,
          only: ['edit', 'view'],
          hint: 'Obligatorio si la entrega se cancela.',
        },
      ],
    },
  ];
}

export default function PedidosCotizacionPage() {
  const [comprobanteDe, setComprobanteDe] = useState(null);
  const [detalleDe, setDetalleDe] = useState(null);
  // Cotización abierta en "Ver pago"
  const [pagosDe, setPagosDe] = useState(null);

  const cotizaciones = useRecurso(cotizacionesService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Pedidos-Cotización']} />
      <DataTable
        title="Pedidos-Cotización"
        columns={columns}
        data={cotizaciones.filas}
        cargando={cotizaciones.cargando}
        error={cotizaciones.error}
        onRecargar={cotizaciones.recargar}
        // NuevoPedidoModal entrega los datos del formulario y las listas para convertirlos
        onCreate={(datos, contexto) =>
          cotizaciones.ejecutar(() => cotizacionesService.crearDesdePanel(datos, contexto))
        }
        onDelete={cotizaciones.eliminar}
        onStatusChange={(fila, estado) => cotizaciones.ejecutar(() => cotizacionesService.cambiarEstado(fila, estado))}
        // Cambios desde las celdas: avanzar la entrega
        onRowUpdate={(fila, cambios) => cotizaciones.ejecutar(() => cotizacionesService.actualizar(fila, cambios))}
        statusKey="estado"
        newLabel="Nueva cotización"
        entityName="cotización"
        titleKey="cliente"
        canView={false}
        statusOptions={estadosCotizacion}
        statusFlow={FLUJO_ESTADOS_COTIZACION}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosCotizacion },
          { key: 'estadoEntrega', label: 'Entrega', options: estadosEntrega },
          { key: 'metodoPago', label: 'Método de pago', options: metodosPago },
          { key: 'estadoPago', label: 'Estado de pago', options: ESTADOS_PAGO },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevoPedidoModal onSubmit={onSubmit} onClose={onClose} />}
        // Pago por confirmar: fila amarilla; rechazado: atenuada. En los dos
        // casos no se cambia el estado ni se edita
        rowClassName={(row) =>
          row.pagoEstado === 'En revisión' ? 'bg-amber-400/15' : row.estadoPago === 'Rechazado' ? 'opacity-50' : ''
        }
        // Con pagos pendientes solo se puede rechazar (la API lo valida);
        // con una consignación por revisar, primero se revisa
        canChangeStatus={(row) => row.pagoEstado !== 'En revisión'}
        canEdit={(row) => !bloqueada(row)}
        rowActions={(row) => (
          <>
            {row.pagoEstado && (
              <button
                onClick={() => setPagosDe(row)}
                className={`rounded p-1 hover:text-amber-500 ${row.pagoEstado === 'En revisión' ? 'text-amber-500' : 'text-slate-400'}`}
                aria-label={`Ver el pago de ${row.id}`}
                title="Ver pago y consignaciones"
              >
                <HandCoins size={15} />
              </button>
            )}
            <button
              onClick={() => setDetalleDe(row)}
              className="rounded p-1 text-slate-400 hover:text-amber-500"
              aria-label={`Ver el detalle de ${row.id}`}
              title="Ver productos y servicios"
            >
              <Eye size={15} />
            </button>
            {/* El comprobante solo se emite con la cotización cerrada */}
            {row.estado === ESTADO_COTIZACION_COMPLETADA && (
              <button
                onClick={() => setComprobanteDe(row)}
                className="rounded p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                aria-label={`Generar comprobante de ${row.id}`}
                title="Generar comprobante de venta"
              >
                <Receipt size={15} />
              </button>
            )}
          </>
        )}
      />

      {pagosDe && (
        <PagosCotizacionModal
          cotizacion={pagosDe}
          onResuelto={cotizaciones.recargar}
          onClose={() => setPagosDe(null)}
        />
      )}

      {detalleDe && (
        <DetalleCotizacionModal
          cotizacion={detalleDe}
          servicio={cotizacionesService}
          onClose={() => setDetalleDe(null)}
        />
      )}
      {comprobanteDe && (
        <ComprobanteVentaModal
          venta={comprobanteDe}
          servicio={cotizacionesService}
          onClose={() => setComprobanteDe(null)}
        />
      )}
    </div>
  );
}
