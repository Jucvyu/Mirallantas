import { useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { columnaCliente } from '../../../components/base/celdaCliente';
import { estadosAbono, mediosPago } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { abonosService } from '../../../services';
import ComprobanteAbonoModal from '../../shared/ComprobanteAbonoModal';
import DetalleAbonoAdminModal from './DetalleAbonoAdminModal';
import NuevoAbonoModal from './NuevoAbonoModal';

// Tabla `abono`. El estado no se cambia desde la tabla: el asesor revisa la
// consignación en "Ver detalle y consignación" y desde ahí lo confirma o lo
// rechaza. Al confirmarlo, la API descuenta el monto del saldo del crédito y
// lo suma a la venta. Un abono no se elimina nunca del sistema.
const columns = [
  { key: 'id', label: 'Nº Abono' },
  { key: 'credito', label: 'Crédito' },
  columnaCliente(),
  { key: 'fecha', label: 'Fecha' },
  { key: 'monto', label: 'Monto' },
  { key: 'metodoPago', label: 'Método de pago' },
  { key: 'estado', label: 'Estado' },
];

// El alta se hace desde `NuevoAbonoModal`; este esquema cubre la edición
// (solo de abonos pendientes).
const formSections = [
  {
    title: 'Crédito asociado',
    fields: [
      { key: 'credito', label: 'Crédito', soloLectura: true },
      { key: 'cliente', label: 'Cliente', soloLectura: true },
    ],
  },
  {
    title: 'Pago',
    fields: [
      { key: 'monto', label: 'Monto (COP)', type: 'money', required: true, placeholder: '2.000.000' },
      { key: 'fecha', label: 'Fecha del abono', soloLectura: true },
      { key: 'metodoPago', label: 'Método de pago', type: 'select', required: true, options: mediosPago },
      { key: 'estado', label: 'Estado', soloLectura: true },
    ],
  },
];

export default function AbonosPage() {
  const [comprobanteDe, setComprobanteDe] = useState(null);
  // Abono abierto en "Ver detalle y consignación"
  const [detalleDe, setDetalleDe] = useState(null);
  // Un abono nuevo se registra sobre su crédito (el servicio se encarga)
  const abonos = useRecurso(abonosService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Abonos']} />
      <DataTable
        title="Abonos"
        columns={columns}
        data={abonos.filas}
        cargando={abonos.cargando}
        error={abonos.error}
        onRecargar={abonos.recargar}
        onCreate={abonos.crear}
        onEdit={abonos.editar}
        statusKey="estado"
        newLabel="Nuevo abono"
        formSections={formSections}
        entityName="abono"
        titleKey="credito"
        statusOptions={estadosAbono}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosAbono },
          { key: 'metodoPago', label: 'Pago', options: mediosPago },
          { key: 'cliente', label: 'Cliente' },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevoAbonoModal onSubmit={onSubmit} onClose={onClose} />}
        canView={false}
        canDelete={false}
        canEdit={(row) => row.estado === 'Pendiente'}
        motivoNoEditable="Solo se corrige un abono pendiente"
        rowActions={(row) => (
          <>
            {/* Pendiente de revisión: el botón resalta para que no se pase por alto */}
            <BotonAccion
              accion="verDetalle"
              icono={FileText}
              etiqueta={row.estado === 'Pendiente' ? 'Ver detalle y consignación · Pendiente de revisión' : 'Ver detalle y consignación'}
              tono={row.estado === 'Pendiente' ? 'destacado' : 'acento'}
              onClick={() => setDetalleDe(row)}
            />
            {/* El comprobante solo se emite con el abono ya validado */}
            <BotonAccion accion="descargarPdf"
              icono={Receipt}
              etiqueta="Generar comprobante del abono"
              tono="exito"
              deshabilitado={row.estado !== 'Confirmado'}
              motivo="El abono todavía no está confirmado"
              onClick={() => setComprobanteDe(row)}
            />
          </>
        )}
      />

      {detalleDe && (
        <DetalleAbonoAdminModal abono={detalleDe} onResuelto={abonos.recargar} onClose={() => setDetalleDe(null)} />
      )}

      {comprobanteDe && (
        <ComprobanteAbonoModal abono={comprobanteDe} onClose={() => setComprobanteDe(null)} />
      )}
    </div>
  );
}
