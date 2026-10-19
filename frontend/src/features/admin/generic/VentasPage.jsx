import { useState } from 'react';
import { Ban, Eye, Receipt } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import {
  CUOTA_INICIAL_CREDITO,
  estadosEntrega,
  estadosVenta,
  FLUJO_ESTADOS_VENTA,
  metodosPago,
} from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesService, proveedoresService, tercerosService, ventasService } from '../../../services';
import { parseCOP } from '../../../utils/formato';
import EstadoEntrega from '../shared/EstadoEntrega';
import ComprobanteVentaModal from '../../shared/ComprobanteVentaModal';
import DetalleCotizacionModal from '../../shared/DetalleCotizacionModal';

/**
 * La empresa exige que la primera cuota cubra al menos la mitad del total
 * cuando la venta se financia. (La API vuelve a comprobarlo al guardar.)
 */
function validarCuotaInicial(values) {
  if (values.metodoPago !== 'Crédito') return {};
  const total = parseCOP(values.total);
  const inicial = parseCOP(values.cuotaInicial);
  const minimo = Math.round(total * CUOTA_INICIAL_CREDITO);
  if (!total) return {};
  if (inicial < minimo) {
    return {
      cuotaInicial: `La primera cuota debe ser de al menos $ ${minimo.toLocaleString('es-CO')} (50% del total).`,
    };
  }
  return {};
}

/**
 * Un campo que se llena al crear la venta y después solo se consulta: se
 * convierte en dos, uno editable al crear y otro de solo lectura al editar.
 */
function soloAlCrear(campo) {
  return [
    { ...campo, only: 'create' },
    { ...campo, type: campo.type === 'select' ? undefined : campo.type, only: ['edit', 'view'], soloLectura: true },
  ];
}

// Tabla `venta`. La venta nace sola cuando la cotización llega a
// "Completada" (con todas sus líneas), y también puede registrarse una
// venta directa con su valor total.
const columns = [
  { key: 'id', label: 'Nº Venta' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'metodoPago', label: 'Método de pago' },
  { key: 'cotizacion', label: 'Cotización', render: (row) => row.cotizacion || 'Venta directa' },
  { key: 'total', label: 'Total' },
  { key: 'estado', label: 'Estado' },
  {
    key: 'estadoEntrega',
    label: 'Entrega',
    render: (row, { update }) => <EstadoEntrega row={row} update={update} />,
  },
];

function seccionesFormulario({ clientes, proveedores, terceros }) {
  const activos = (lista, campo) => lista.filter((x) => x.activo).map((x) => x[campo]);
  return [
    {
      title: 'Datos de la venta',
      fields: [
        ...soloAlCrear({
          key: 'cliente',
          label: 'Cliente',
          type: 'select',
          required: true,
          options: activos(clientes, 'nombreCompleto'),
          emptyLabel: 'cliente',
        }),
        {
          key: 'proveedor',
          label: 'Proveedor',
          type: 'select',
          options: activos(proveedores, 'nombreRazonSocial'),
          emptyLabel: 'proveedor',
          hint: 'Proveedor que surtió los productos vendidos.',
        },
        ...soloAlCrear({ key: 'fecha', label: 'Fecha', type: 'date', required: true }),
        ...soloAlCrear({ key: 'metodoPago', label: 'Método de pago', type: 'select', required: true, options: metodosPago }),
        {
          key: 'tercero',
          label: 'Tercero (reencauchadora)',
          type: 'select',
          options: activos(terceros, 'nombreRazonSocial'),
          hint: 'Solo si la venta incluye un servicio de reencauche.',
        },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosVenta, only: ['edit', 'view'] },
        { key: 'estadoEntrega', label: 'Estado de la entrega', type: 'select', options: estadosEntrega, only: ['edit', 'view'] },
      ],
    },
    {
      title: 'Valores',
      fields: [
        ...soloAlCrear({ key: 'total', label: 'Valor total (COP)', type: 'money', required: true, placeholder: '1.968.000' }),
        ...soloAlCrear({ key: 'interes', label: 'Interés (COP)', type: 'money', placeholder: '0' }),
        ...soloAlCrear({
          key: 'cuotaInicial',
          label: 'Cuota inicial (COP)',
          type: 'money',
          placeholder: '0',
          hint: 'A crédito, no puede ser menor al 50% del total.',
        }),
      ],
    },
    {
      title: 'Soporte del pago',
      fields: [
        {
          key: 'comprobantePago',
          label: 'Comprobante de pago',
          type: 'image',
          span: 2,
          placeholder: 'Sube el pantallazo de la consignación o el recibo',
          hint: 'Queda adjunto a la venta como respaldo del pago recibido.',
        },
      ],
    },
  ];
}

export default function VentasPage() {
  const [comprobanteDe, setComprobanteDe] = useState(null);
  const [detalleDe, setDetalleDe] = useState(null);
  // Venta que se va a anular, a la espera de la confirmación
  const [anulando, setAnulando] = useState(null);

  const clientes = useRecurso(clientesService);
  const proveedores = useRecurso(proveedoresService);
  const terceros = useRecurso(tercerosService);
  const ventas = useRecurso(ventasService);

  // El servicio usa estas listas para enviar los nombres elegidos como ids
  const contexto = { clientes: clientes.filas, proveedores: proveedores.filas, terceros: terceros.filas };

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Ventas']} />
      <DataTable
        title="Ventas"
        columns={columns}
        data={ventas.filas}
        cargando={ventas.cargando}
        error={ventas.error}
        onRecargar={ventas.recargar}
        onCreate={(valores) => ventas.crear(valores, contexto)}
        onEdit={(fila, valores) => ventas.editar(fila, valores, contexto)}
        onStatusChange={(fila, estado) => ventas.ejecutar(() => ventasService.cambiarEstado(fila, estado))}
        onRowUpdate={(fila, cambios) => ventas.ejecutar(() => ventasService.actualizar(fila, cambios))}
        statusKey="estado"
        newLabel="Nueva venta"
        formSections={seccionesFormulario({
          clientes: clientes.filas,
          proveedores: proveedores.filas,
          terceros: terceros.filas,
        })}
        entityName="venta"
        titleKey="cliente"
        // Una venta no se borra: se anula, y queda en el historial
        canDelete={false}
        statusOptions={estadosVenta}
        statusFlow={FLUJO_ESTADOS_VENTA}
        formValidate={validarCuotaInicial}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosVenta },
          { key: 'estadoEntrega', label: 'Entrega', options: estadosEntrega },
          { key: 'metodoPago', label: 'Pago', options: metodosPago },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rowActions={(row, { update }) => (
          <>
            {row.estado !== 'Anulada' && (
              <button
                onClick={() => setAnulando({ row, update })}
                className="rounded p-1 text-red-500 hover:text-red-600"
                aria-label={`Anular ${row.id}`}
                title="Anular la venta"
              >
                <Ban size={15} />
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
            {row.estado === 'Completada' && (
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

      {detalleDe && (
        <DetalleCotizacionModal
          cotizacion={detalleDe}
          servicio={ventasService}
          onClose={() => setDetalleDe(null)}
        />
      )}
      {comprobanteDe && (
        <ComprobanteVentaModal
          venta={comprobanteDe}
          servicio={ventasService}
          onClose={() => setComprobanteDe(null)}
        />
      )}

      {anulando && (
        <ConfirmDialog
          title="¿Anular la venta?"
          message="La venta queda registrada como anulada y deja de contar para los reportes."
          confirmLabel="Anular venta"
          record={{ title: anulando.row.id, subtitle: `${anulando.row.cliente} · ${anulando.row.total}` }}
          onConfirm={() => anulando.update({ estado: 'Anulada' })}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
