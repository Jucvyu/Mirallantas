import { useState } from 'react';
import { Wallet } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { creditosService } from '../../../services';
import HistorialAbonosModal from './HistorialAbonosModal';
import NuevoCreditoModal from './NuevoCreditoModal';

/** Un crédito está vencido si pasó su fecha límite y aún debe. */
function vencido(row) {
  if (!row.fechaLimite) return false;
  return row.saldoValor > 0 && new Date(row.fechaLimite) < new Date();
}

// Tabla `credito`: cliente, monto total, saldo pendiente, plazo, fechas y
// estado. El saldo baja solo cuando un asesor confirma un abono.
const columns = [
  { key: 'id', label: 'Nº Crédito' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'montoTotal', label: 'Monto total' },
  { key: 'saldoPendiente', label: 'Saldo pendiente' },
  { key: 'plazoDias', label: 'Plazo', render: (row) => `${row.plazoDias} días` },
  {
    key: 'fechaLimite',
    label: 'Fecha límite',
    render: (row) => (
      <span className={vencido(row) ? 'font-semibold text-red-500' : ''}>
        {row.fechaLimite}
        {vencido(row) ? ' · vencido' : ''}
      </span>
    ),
  },
  { key: 'estado', label: 'Estado' },
];

// Solo para consultar el detalle: un crédito no se edita a mano
const formSections = [
  {
    title: 'Origen del crédito',
    fields: [
      { key: 'cliente', label: 'Cliente' },
      { key: 'cotizacion', label: 'Cotización financiada' },
      { key: 'venta', label: 'Venta' },
      { key: 'montoTotal', label: 'Monto total (COP)' },
      { key: 'saldoPendiente', label: 'Saldo pendiente (COP)' },
    ],
  },
  {
    title: 'Plazo',
    fields: [
      { key: 'plazoDias', label: 'Plazo (días)' },
      { key: 'fechaApertura', label: 'Fecha de apertura' },
      { key: 'fechaLimite', label: 'Fecha límite' },
      { key: 'estado', label: 'Estado' },
    ],
  },
];

export default function CreditosPage() {
  // Crédito cuyo historial de abonos se está consultando
  const [abonosDe, setAbonosDe] = useState(null);
  const creditos = useRecurso(creditosService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Cartera']} />
      <DataTable
        title="Cartera de créditos"
        columns={columns}
        data={creditos.filas}
        cargando={creditos.cargando}
        error={creditos.error}
        onRecargar={creditos.recargar}
        onCreate={creditos.crear}
        onStatusChange={(fila, estado) => creditos.ejecutar(() => creditosService.cambiarEstado(fila, estado))}
        newLabel="Nuevo crédito"
        formSections={formSections}
        entityName="crédito"
        titleKey="cliente"
        canEdit={false}
        canDelete={false}
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[
          { key: 'estado', label: 'Estado', options: estadosActivo },
          { key: 'cliente', label: 'Cliente' },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevoCreditoModal onSubmit={onSubmit} onClose={onClose} />}
        rowActions={(row) => (
          <BotonAccion icono={Wallet} etiqueta="Subir abonos y ver el historial" tono="destacado" onClick={() => setAbonosDe(row)} />
        )}
      />

      {abonosDe && (
        <HistorialAbonosModal
          credito={abonosDe}
          // Al cerrar se recarga la cartera: un abono pudo cambiar el saldo
          onClose={() => {
            setAbonosDe(null);
            creditos.recargar();
          }}
        />
      )}
    </div>
  );
}
