import { useState } from 'react';
import { FileText } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { columnaCliente } from '../../../components/base/celdaCliente';
import { estadosSolicitudCredito, PLAZOS_CREDITO } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { opcionesClientes } from '../../../utils/opciones';
import { clientesSeleccionablesService, solicitudesCreditoService } from '../../../services';
import DetalleSolicitudCreditoModal from './DetalleSolicitudCreditoModal';

// Solicitudes de crédito. Cada cotización-pedido a crédito crea la suya
// (Pendiente). El administrador revisa "Ver detalle y consignación" y la
// aprueba o no: al aprobarla, la API abre el crédito en la cartera del
// cliente y la solicitud queda "Pendiente de cuota inicial" hasta que se
// confirma ese pago (entonces pasa sola a "Aprobada"); al no aprobarla, la
// cotización se rechaza. El estado no se cambia a mano.
const columns = [
  { key: 'id', label: 'Nº Solicitud' },
  columnaCliente(),
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
        // Buscador por nombre o documento: guarda el id real del cliente
        { key: 'clienteId', label: 'Cliente', type: 'buscador', required: true, options: opciones, placeholderBusqueda: 'Nombre o número de documento', emptyLabel: 'cliente' },
        { key: 'monto', label: 'Monto solicitado (COP)', type: 'money', required: true, placeholder: '800.000' },
        { key: 'plazoDias', label: 'Plazo (días)', type: 'select', required: true, options: PLAZOS_CREDITO.map(String) },
      ],
    },
  ];
}

export default function SolicitudesCreditoPage() {
  const clientes = useRecurso(clientesSeleccionablesService);
  const solicitudes = useRecurso(solicitudesCreditoService);
  // Solicitud abierta en "Ver detalle y consignación"
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
        // Nada se edita a mano: se aprueba o rechaza desde "Ver detalle y consignación"
        canView={false}
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
          // Pendiente de revisión: el botón resalta para que no se pase por alto
          <BotonAccion
            accion="verDetalle"
            icono={FileText}
            etiqueta={row.estado === 'Pendiente' ? 'Ver detalle y consignación · Pendiente de revisión' : 'Ver detalle y consignación'}
            tono={row.estado === 'Pendiente' ? 'destacado' : 'acento'}
            onClick={() => setDetalleDe(row)}
          />
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
