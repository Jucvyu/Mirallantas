import { useState } from 'react';
import { Clock, HandCoins, TriangleAlert } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import { MEDIOS_PAGO_CLIENTE } from '../../constantes';
import Modal from '../../components/base/Modal';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService } from '../../services';
import { CamposPago, HistorialPagos, pideComprobante } from '../shared/PagoConsignacion';

/** Formulario para volver a subir el pago rechazado de una cotización de contado. */
function VolverAPagarModal({ cotizacion, onPagado, onClose }) {
  const [pago, setPago] = useState({ medioPago: '', comprobante: '' });
  const { enviando, errorEnvio, enviar } = useEnvio();
  const listo = pago.medioPago && (!pideComprobante(pago.medioPago) || pago.comprobante);

  return (
    <Modal
      title="Volver a subir el pago"
      subtitle={`${cotizacion.id} · ${cotizacion.totalProductos}`}
      icon={<HandCoins size={17} />}
      size="md"
      onClose={onClose}
      footer={(cerrar) => (
        <button
          type="button"
          disabled={!listo || enviando}
          onClick={() =>
            enviar(async () => {
              await cotizacionesService.volverAPagar(cotizacion.id, pago);
              await onPagado?.();
            }, cerrar)
          }
          className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar pago'}
        </button>
      )}
    >
      <div className="space-y-4">
        <AvisoError mensaje={errorEnvio} />
        <CamposPago pago={pago} onCambio={setPago} medios={MEDIOS_PAGO_CLIENTE} />
      </div>
    </Modal>
  );
}

/**
 * Pago de contado de una cotización en "Mis cotizaciones": el aviso del
 * estado (amarillo pendiente, rojo rechazado), el botón para volver a
 * subirlo y el historial de consignaciones.
 */
export default function PagoCotizacion({ cotizacion, onPagado }) {
  const [pagando, setPagando] = useState(false);
  if (!cotizacion.pagoEstado) return null;
  const ultimo = cotizacion.pagos?.[0];

  return (
    <div className="mt-4 space-y-2">
      {cotizacion.pagoEstado === 'En revisión' && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <Clock size={14} className="mt-px shrink-0" />
          Tu pago está pendiente de confirmación del administrador para continuar con el proceso.
        </p>
      )}
      {cotizacion.pagoEstado === 'Rechazado' && (
        <div className="space-y-2 rounded-lg border border-red-400 bg-red-500/10 px-3 py-2">
          <p className="flex items-start gap-2 text-xs font-medium text-red-600 dark:text-red-400">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            El pago fue rechazado{ultimo?.motivo ? ` (${ultimo.motivo})` : ''}. Por favor vuelve a subir el pago.
          </p>
          <button
            type="button"
            onClick={() => setPagando(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-red-500 py-1.5 text-[11px] font-bold text-white hover:bg-red-600"
          >
            <HandCoins size={12} /> Volver a subir el pago
          </button>
        </div>
      )}

      <HistorialPagos pagos={cotizacion.pagos} />

      {pagando && <VolverAPagarModal cotizacion={cotizacion} onPagado={onPagado} onClose={() => setPagando(false)} />}
    </div>
  );
}
