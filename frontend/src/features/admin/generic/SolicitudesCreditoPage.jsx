import { useState } from 'react';
import { FileText } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosSolicitudCredito, FLUJO_ESTADOS_SOLICITUD_CREDITO, PLAZOS_CREDITO } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { opcionesClientes } from '../../../utils/opciones';
import { clientesService, solicitudesCreditoService } from '../../../services';
import DetalleSolicitudCreditoModal from './DetalleSolicitudCreditoModal';

// Solicitudes de crédito. Cada cotización-pedido a crédito crea la suya
// (Pendiente). El administrador revisa el detalle y la consignación ("Ver
// detalle") y la aprueba o no: al aprobarla, la API abre el crédito en la
// cartera del cliente; al no aprobarla, la cotización se rechaza.
const columns = [
  { key: 'id', label: 'Nº Solicitud' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'cotizacion', label: 'Cotización', render: (row) => row.cotizacion || '—' },
  { key: 'monto', label: 'Monto a financiar' },
  { key: 'plazoDias', label: 'Plazo', render: (row) => `${row.plazoDias} días` },
  { key: 'fecha', label: 'Fecha' },
  { key: 'motivo', label: 'Motivo del rechazo', render: (row) => row.motivo || '—' },
  { key: 'estado', label: 'Estado' },
];

function seccionesFormulario(opciones) {
  return [
    {
      title: 'Datos de la solicitud',
      fields: [
        // Al crear se eligen; después solo se consultan
        // Buscador por nombre o documento: guarda el id real del cliente
        { key: 'clienteId', label: 'Cliente', type: 'buscador', required: true, options: opciones, placeholderBusqueda: 'Nombre o número de documento', emptyLabel: 'cliente', only: 'create' },
        { key: 'cliente', label: 'Cliente', only: ['edit', 'view'], soloLectura: true },
        { key: 'monto', label: 'Monto solicitado (COP)', type: 'money', required: true, placeholder: '800.000', only: 'create' },
        { key: 'monto', label: 'Monto solicitado (COP)', only: ['edit', 'view'], soloLectura: true },
        { key: 'plazoDias', label: 'Plazo (días)', type: 'select', required: true, options: PLAZOS_CREDITO.map(String), only: 'create' },
        { key: 'plazoDias', label: 'Plazo (días)', only: ['edit', 'view'], soloLectura: true },
        { key: 'fecha', label: 'Fecha', only: ['edit', 'view'], soloLectura: true },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosSolicitudCredito, only: ['edit', 'view'] },
        {
          key: 'motivo',
          label: 'Motivo del rechazo',
          type: 'textarea',
          span: 2,
          only: ['edit', 'view'],
          hint: 'Obligatorio cuando la solicitud se rechaza.',
        },
      ],
    },
  ];
}

export default function SolicitudesCreditoPage() {
  const clientes = useRecurso(clientesService);
  const solicitudes = useRecurso(solicitudesCreditoService);
  // Solicitud abierta en "Ver detalle"
  const [detalleDe, setDetalleDe] = useState(null);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Solicitudes de crédito']} />
      <DataTable
        title="Solicitudes de crédito"
        columns={columns}
        data={solicitudes.filas}
        cargando={solicitudes.cargando}
        error={solicitudes.error}
        onRecargar={solicitudes.recargar}
        onCreate={(valores) => solicitudes.crear(valores, { clientes: clientes.filas })}
        onEdit={solicitudes.editar}
        onDelete={solicitudes.eliminar}
        // Para rechazar hace falta el motivo: se hace desde "Editar"
        onStatusChange={(fila, estado) =>
          solicitudes.ejecutar(() => solicitudesCreditoService.cambiarEstado(fila, estado))
        }
        statusKey="estado"
        newLabel="Nueva solicitud"
        formSections={seccionesFormulario(opcionesClientes(clientes.filas))}
        entityName="solicitud"
        titleKey="cliente"
        statusOptions={estadosSolicitudCredito}
        statusFlow={FLUJO_ESTADOS_SOLICITUD_CREDITO}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosSolicitudCredito },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rowActions={(row) => (
          <button
            onClick={() => setDetalleDe(row)}
            className="rounded p-1 text-slate-400 hover:text-amber-500"
            aria-label={`Ver el detalle de ${row.id}`}
            title="Ver detalle y consignación"
          >
            <FileText size={15} />
          </button>
        )}
      />

      {detalleDe && (
        <DetalleSolicitudCreditoModal
          solicitud={detalleDe}
          onResuelta={solicitudes.recargar}
          onClose={() => setDetalleDe(null)}
        />
      )}
    </div>
  );
}
