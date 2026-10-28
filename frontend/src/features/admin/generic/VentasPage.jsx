import { useState } from 'react';
import { Ban, Eye, Receipt } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import { CUOTA_INICIAL_PORCENTAJE, cuotaMinimaDe, metodosPago } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesService, proveedoresService, tercerosService, ventasService } from '../../../services';
import { parseCOP } from '../../../utils/formato';
import { opcionesClientes, opcionesEmpresas } from '../../../utils/opciones';
import ComprobanteVentaModal from '../../shared/ComprobanteVentaModal';
import DetalleCotizacionModal from '../../shared/DetalleCotizacionModal';

/**
 * Venta a crédito: la cuota inicial cubre al menos el 30 % del total (el
 * 70 % restante se financia); de contado se paga el 100 %. La API vuelve a
 * comprobarlo al guardar.
 */
function validarCuotaInicial(values) {
  if (values.metodoPago !== 'Crédito') return {};
  const total = parseCOP(values.total);
  const inicial = parseCOP(values.cuotaInicial);
  if (!total) return {};
  const minimo = cuotaMinimaDe(total);
  if (inicial < minimo) {
    return {
      cuotaInicial: `La cuota inicial debe ser de al menos $ ${minimo.toLocaleString('es-CO')} (${CUOTA_INICIAL_PORCENTAJE} % del total).`,
    };
  }
  if (inicial >= total) return { cuotaInicial: 'Si se paga todo de una vez, registra la venta de contado.' };
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
// venta directa con su valor total. El estado y la entrega son del
// pedido-cotización: aquí no se muestran (solo se marca la venta anulada).
const columns = [
  // La fecha va debajo del número: así la tabla cabe sin desplazarse de lado
  {
    key: 'id',
    label: 'Nº Venta / Fecha',
    render: (row) => (
      <span className="flex flex-col">
        <span className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{row.id}</span>
        <span className="whitespace-nowrap text-[11px] text-slate-400">{row.fecha}</span>
        {row.estado === 'Anulada' && <span className="text-[11px] font-semibold text-red-500">Anulada</span>}
      </span>
    ),
  },
  { key: 'cliente', label: 'Cliente' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'metodoPago', label: 'Método de pago' },
  { key: 'cotizacion', label: 'Cotización', render: (row) => row.cotizacion || 'Venta directa' },
  { key: 'total', label: 'Total' },
];

function seccionesFormulario({ clientes, proveedores, terceros }) {
  return [
    {
      title: 'Datos de la venta',
      fields: [
        // Buscador por nombre o documento: guarda el id real del cliente
        {
          key: 'clienteId',
          label: 'Cliente',
          type: 'buscador',
          required: true,
          options: opcionesClientes(clientes),
          placeholderBusqueda: 'Nombre o número de documento',
          emptyLabel: 'cliente',
          only: 'create',
        },
        { key: 'cliente', label: 'Cliente', only: ['edit', 'view'], soloLectura: true },
        {
          key: 'proveedorId',
          label: 'Proveedor',
          type: 'buscador',
          options: opcionesEmpresas(proveedores),
          placeholderBusqueda: 'Razón social o NIT',
          emptyLabel: 'proveedor',
          hint: 'Proveedor que surtió los productos vendidos.',
        },
        ...soloAlCrear({ key: 'fecha', label: 'Fecha', type: 'date', required: true }),
        ...soloAlCrear({ key: 'metodoPago', label: 'Método de pago', type: 'select', required: true, options: metodosPago }),
        {
          key: 'terceroId',
          label: 'Tercero (reencauchadora)',
          type: 'buscador',
          options: opcionesEmpresas(terceros),
          placeholderBusqueda: 'Razón social o NIT',
          emptyLabel: 'tercero',
          hint: 'Solo si la venta incluye un servicio de reencauche.',
        },
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
          hint: `A crédito, al menos el ${CUOTA_INICIAL_PORCENTAJE} % del total (el resto se financia). De contado se paga el 100 %.`,
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
        // Solo para anular la venta (botón de la fila)
        onRowUpdate={(fila, cambios) => ventas.ejecutar(() => ventasService.actualizar(fila, cambios))}
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
        formValidate={validarCuotaInicial}
        filters={[
          { key: 'metodoPago', label: 'Pago', options: metodosPago },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rowActions={(row, { update }) => (
          <>
            <BotonAccion accion="verDetalle" icono={Eye} etiqueta="Ver productos y servicios" tono="acento" onClick={() => setDetalleDe(row)} />
            <BotonAccion accion="descargarPdf"
              icono={Receipt}
              etiqueta="Generar comprobante de venta"
              tono="exito"
              deshabilitado={row.estado !== 'Completada'}
              motivo="La venta todavía no está completada"
              onClick={() => setComprobanteDe(row)}
            />
            <BotonAccion accion="anular"
              icono={Ban}
              etiqueta="Anular la venta"
              tono="peligro"
              deshabilitado={row.estado === 'Anulada' || Boolean(row.cotizacion)}
              motivo={row.cotizacion ? `Sigue a la cotización ${row.cotizacion}: cancélala allí` : 'La venta ya está anulada'}
              onClick={() => setAnulando({ row, update })}
            />
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
          onDescargarPdf={(v) => ventasService.descargarPdf(v.id)}
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
