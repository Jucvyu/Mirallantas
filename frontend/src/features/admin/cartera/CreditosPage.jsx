import { useState } from 'react';
import { Wallet } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { columnaCliente } from '../../../components/base/celdaCliente';
import { CREDITO_SIN_INICIAR, estadosActivo } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { creditosService } from '../../../services';
import HistorialAbonosModal from './HistorialAbonosModal';

/** Un crédito está vencido si pasó su fecha límite y aún debe. */
function vencido(row) {
  if (!row.fechaLimite) return false;
  return row.iniciado && row.saldoValor > 0 && new Date(row.fechaLimite) < new Date();
}

// Tabla `credito`: cliente, monto total, saldo pendiente, plazo, fechas y
// estado. El saldo baja solo cuando un asesor confirma un abono.
const columns = [
  { key: 'id', label: 'Nº Crédito' },
  columnaCliente(),
  { key: 'montoTotal', label: 'Monto total' },
  { key: 'saldoPendiente', label: 'Saldo pendiente' },
  { key: 'plazoDias', label: 'Plazo', render: (row) => `${row.plazoDias} días` },
  {
    key: 'fechaLimite',
    label: 'Fecha límite',
    render: (row) =>
      row.iniciado ? (
        <span className={vencido(row) ? 'font-semibold text-red-500' : ''}>
          {row.fechaLimite}
          {vencido(row) ? ' · vencido' : ''}
        </span>
      ) : (
        // El plazo empieza a correr cuando se paga la cuota inicial
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{CREDITO_SIN_INICIAR}</span>
      ),
  },
  { key: 'estado', label: 'Estado' },
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
        onStatusChange={(fila, estado) => creditos.ejecutar(() => creditosService.cambiarEstado(fila, estado))}
        entityName="crédito"
        titleKey="cliente"
        // El detalle es el del botón de abonos: datos del crédito e historial
        canView={false}
        canEdit={false}
        canDelete={false}
        statusKey="estado"
        statusOptions={estadosActivo}
        statusVariant="switch"
        filters={[
          { key: 'estado', label: 'Estado', options: estadosActivo },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rowActions={(row) => (
          <BotonAccion accion="verDetalle"
            icono={Wallet}
            etiqueta="Ver detalle, historial y subir abonos"
            tono="destacado"
            onClick={() => setAbonosDe(row)}
          />
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
