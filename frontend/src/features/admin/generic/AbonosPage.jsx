import { useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosAbono, FLUJO_ESTADOS_ABONO, mediosPago } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { abonosService } from '../../../services';
import ComprobanteAbonoModal from '../../shared/ComprobanteAbonoModal';
import DetalleAbonoAdminModal from './DetalleAbonoAdminModal';
import NuevoAbonoModal from './NuevoAbonoModal';

// Tabla `abono`. El asesor revisa la consignación ("Ver detalle") y pasa el
// abono a "Confirmado": en ese momento la API descuenta el monto del saldo
// del crédito y sube el saldo usable del cliente. Un abono no se elimina
// nunca del sistema.
const columns = [
  { key: 'id', label: 'Nº Abono' },
  { key: 'credito', label: 'Crédito' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'monto', label: 'Monto' },
  { key: 'metodoPago', label: 'Método de pago' },
  { key: 'estado', label: 'Estado' },
];

// El alta se hace desde `NuevoAbonoModal`; este esquema cubre la edición
// (solo de abonos pendientes) y el detalle.
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
      { key: 'fecha', label: 'Fecha del abono', only: ['edit', 'view'], soloLectura: true },
      { key: 'metodoPago', label: 'Método de pago', type: 'select', required: true, options: mediosPago },
      { key: 'estado', label: 'Estado', type: 'select', options: estadosAbono, only: ['edit', 'view'] },
      {
        key: 'comprobante',
        label: 'Comprobante de pago',
        type: 'image',
        span: 2,
        only: 'view',
        placeholder: 'Pantallazo de la consignación',
        hint: 'Debe validarse antes de confirmar el abono.',
      },
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
        onStatusChange={(fila, estado) => abonos.ejecutar(() => abonosService.cambiarEstado(fila, estado))}
        statusKey="estado"
        newLabel="Nuevo abono"
        formSections={formSections}
        entityName="abono"
        titleKey="credito"
        statusOptions={estadosAbono}
        statusFlow={FLUJO_ESTADOS_ABONO}
        filters={[
          { key: 'estado', label: 'Estado', options: estadosAbono },
          { key: 'metodoPago', label: 'Pago', options: mediosPago },
          { key: 'cliente', label: 'Cliente' },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevoAbonoModal onSubmit={onSubmit} onClose={onClose} />}
        canDelete={false}
        rowActions={(row) => (
          <>
            <button
              onClick={() => setDetalleDe(row)}
              className="rounded p-1 text-slate-400 hover:text-amber-500"
              aria-label={`Ver el detalle de ${row.id}`}
              title="Ver detalle y consignación"
            >
              <FileText size={15} />
            </button>
            {/* El comprobante solo se emite con el abono ya validado */}
            {row.estado === 'Confirmado' && (
              <button
                onClick={() => setComprobanteDe(row)}
                className="rounded p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                aria-label={`Generar el comprobante de ${row.id}`}
                title="Generar comprobante del abono"
              >
                <Receipt size={15} />
              </button>
            )}
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
