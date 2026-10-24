import { useState } from 'react';
import { FileText } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosSolicitudCredito, PLAZOS_CREDITO } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { opcionesClientes } from '../../../utils/opciones';
import { clientesService, solicitudesCreditoService } from '../../../services';
import DetalleSolicitudCreditoModal from './DetalleSolicitudCreditoModal';

// Solicitudes de crédito. Cada cotización-pedido a crédito crea la suya
// (Pendiente). El administrador revisa el detalle ("Ver detalle") y la
// aprueba o no: al aprobarla, la API abre el crédito en la cartera del
// cliente y la solicitud queda "Pendiente de cuota inicial" hasta que se
// confirma ese pago (entonces pasa sola a "Aprobada"); al no aprobarla, la
// cotización se rechaza. El estado no se cambia a mano.
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
        { key: 'cliente', label: 'Cliente', only: 'view' },
        { key: 'monto', label: 'Monto solicitado (COP)', type: 'money', required: true, placeholder: '800.000', only: 'create' },
        { key: 'monto', label: 'Monto solicitado (COP)', only: 'view' },
        { key: 'plazoDias', label: 'Plazo (días)', type: 'select', required: true, options: PLAZOS_CREDITO.map(String), only: 'create' },
        { key: 'plazoDias', label: 'Plazo (días)', only: 'view' },
        { key: 'fecha', label: 'Fecha', only: 'view' },
        { key: 'estado', label: 'Estado', only: 'view' },
        { key: 'motivo', label: 'Motivo del rechazo', type: 'textarea', span: 2, only: 'view' },
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
        // Nada se edita a mano: se aprueba o rechaza desde "Ver detalle"
        canEdit={false}
        onDelete={solicitudes.eliminar}
        statusKey="estado"
        newLabel="Nueva solicitud"
        formSections={seccionesFormulario(opcionesClientes(clientes.filas))}
        entityName="solicitud"
        titleKey="cliente"
        statusOptions={estadosSolicitudCredito}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosSolicitudCredito },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rowActions={(row) => (
          <BotonAccion icono={FileText} etiqueta="Ver detalle y consignación" tono="acento" onClick={() => setDetalleDe(row)} />
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
