import { useState } from 'react';
import { Check, HandCoins, ReceiptText, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import { DetalleAviso, DetalleDatos, DetalleImagen, DetalleResumen, DetalleSeccion } from '../../../components/base/Detalle';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useEnvio } from '../../../hooks/useEnvio';
import { solicitudesServicioService } from '../../../services';
import { TONO_PAGO } from './tonosPago';
import { MAX_TEXTO } from '../../../utils/validaciones';

/**
 * Pago de un servicio de reencauche (módulo Solicitudes de servicio).
 *
 * Muestra el valor asignado y el pago que hizo el cliente con su
 * comprobante. Desde aquí el asesor:
 *   · aprueba el pago (también si el cliente pagó en el local, sin
 *     comprobante) → el reencauche ya puede avanzar;
 *   · lo rechaza con el motivo → el cliente lo ve en rojo y vuelve a subirlo.
 * En los dos casos el cliente recibe una notificación.
 */
export default function DetallePagoServicioModal({ solicitud, onResuelto, onClose }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();
  const enRevision = solicitud.pagoEstado === 'En revisión';
  const puedeAprobar = enRevision || solicitud.pagoEstado === 'Por pagar';

  const resolver = (estado, cerrar) =>
    enviar(async () => {
      await solicitudesServicioService.revisarPago(solicitud, estado, motivo.trim());
      await onResuelto?.();
    }, cerrar);

  const pie = (cerrar) => {
    if (!puedeAprobar) {
      return (
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
        >
          Cerrar
        </button>
      );
    }
    if (rechazando) {
      return (
        <>
          <button
            type="button"
            onClick={() => setRechazando(false)}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => resolver('Rechazado', cerrar)}
            disabled={enviando || !motivo.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
          >
            <X size={15} /> Confirmar rechazo
          </button>
        </>
      );
    }
    return (
      <>
        {enRevision && (
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <X size={15} /> Rechazar pago
          </button>
        )}
        <button
          type="button"
          onClick={() => resolver('Aprobado', cerrar)}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Check size={15} /> {enRevision ? 'Aprobar pago' : 'Pagó en el local'}
        </button>
      </>
    );
  };

  return (
    <Modal
      title="Pago del servicio"
      subtitle={`${solicitud.id} · ${solicitud.cliente ?? ''}`}
      icon={<HandCoins size={17} />}
      size="md"
      onClose={onClose}
      footer={pie}
    >
      <div className="space-y-5">
        <AvisoError mensaje={errorEnvio} />

        <DetalleResumen
          etiqueta="Valor del servicio"
          valor={solicitud.precio || 'Sin asignar'}
          estado={solicitud.pagoEstado}
          tonoEstado={TONO_PAGO[solicitud.pagoEstado]}
        />

        {solicitud.pagoEstado === 'Sin precio' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Primero asígnale un valor desde "Editar" (campo "Valor del servicio"). El cliente recibirá un aviso para pagarlo.
          </p>
        )}

        <DetalleDatos
          datos={[
            { etiqueta: 'Cotización', valor: solicitud.cotizacion },
            { etiqueta: 'Servicio', valor: `${solicitud.servicio} · ${solicitud.cantidad} llantas` },
            { etiqueta: 'Método de pago', valor: solicitud.pagoMedio },
            { etiqueta: 'Fecha del pago', valor: solicitud.pagoFecha },
          ]}
        />

        {solicitud.pagoMotivo && <DetalleAviso tono="peligro">Rechazado: {solicitud.pagoMotivo}</DetalleAviso>}

        <DetalleSeccion titulo="Comprobante" icono={<ReceiptText size={15} />}>
          <DetalleImagen
            src={solicitud.pagoComprobante}
            alt={`Comprobante del pago de ${solicitud.id}`}
            vacio={solicitud.pagoMedio === 'Efectivo' ? 'Pago en efectivo: sin comprobante.' : 'El cliente aún no ha subido el pago.'}
          />
        </DetalleSeccion>

        {rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo del rechazo</span>
            <textarea
              maxLength={MAX_TEXTO}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="El cliente lo verá y volverá a subir el comprobante."
              className={`${INPUT} ${BORDER_OK} mt-1.5 resize-none`}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
