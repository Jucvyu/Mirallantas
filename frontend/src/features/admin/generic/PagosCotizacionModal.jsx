import { useState } from 'react';
import { Check, HandCoins, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useDetalle } from '../../../hooks/useDetalle';
import { useEnvio } from '../../../hooks/useEnvio';
import { cotizacionesService } from '../../../services';
import { MEDIOS_PAGO_CLIENTE } from '../../../constantes';
import { CamposPago, pideComprobante, TarjetaPago } from '../../shared/PagoConsignacion';
import { SkeletonLineas } from '../../../components/base/Skeleton';

/**
 * Consignaciones del pago de contado de una cotización (módulo
 * Pedidos-Cotización).
 *
 * Muestra todos los intentos, del más nuevo al más viejo: el pendiente con
 * contorno amarillo y los rechazados en rojo y atenuados. Si el más nuevo
 * está "En revisión", el asesor lo aprueba (la cotización sigue su proceso)
 * o lo rechaza con el motivo (el cliente recibe el aviso para subir otro).
 *
 * A crédito ya aprobado, si el cliente paga la cuota inicial en el local,
 * el asesor la registra aquí (queda en revisión para aprobarla).
 */
export default function PagosCotizacionModal({ cotizacion: inicial, onResuelto, onClose }) {
  // Las consignaciones vienen en el detalle de la cotización
  const { documento: cotizacion, cargando, error } = useDetalle({ ...inicial, detalle: undefined }, cotizacionesService);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();
  const pagos = cotizacion.pagos ?? [];
  const porRevisar = pagos[0]?.estado === 'En revisión';
  // Crédito sin cuota pagada (o con la última rechazada): se puede registrar en el local
  const puedeRegistrarCuota = cotizacion.metodoPago === 'Crédito' && (pagos.length === 0 || pagos[0]?.estado === 'Rechazado');
  const [cuota, setCuota] = useState({ medioPago: '', comprobante: '' });
  const cuotaLista = cuota.medioPago && (!pideComprobante(cuota.medioPago) || cuota.comprobante);
  const registrarCuota = () =>
    enviar(async () => {
      await cotizacionesService.pagarCuota(cotizacion.id, cuota, { desdePortal: false });
      setCuota({ medioPago: '', comprobante: '' });
      await onResuelto?.();
    });

  const resolver = (estado, cerrar) =>
    enviar(async () => {
      await cotizacionesService.revisarPago(cotizacion, estado, motivo.trim());
      await onResuelto?.();
    }, cerrar);

  const pie = (cerrar) => {
    if (!porRevisar && puedeRegistrarCuota) {
      return (
        <button
          type="button"
          onClick={registrarCuota}
          disabled={enviando || !cuotaLista}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-50"
        >
          <HandCoins size={15} /> {enviando ? 'Guardando…' : 'Registrar la cuota inicial'}
        </button>
      );
    }
    if (!porRevisar) {
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
        <button
          type="button"
          onClick={() => setRechazando(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          <X size={15} /> Desaprobar
        </button>
        <button
          type="button"
          onClick={() => resolver('Aprobado', cerrar)}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Check size={15} /> {enviando ? 'Guardando…' : 'Aprobar consignación'}
        </button>
      </>
    );
  };

  return (
    <Modal
      title="Pago de la cotización"
      subtitle={`${inicial.id} · ${inicial.cliente ?? ''} · ${inicial.totalProductos ?? inicial.total}`}
      icon={<HandCoins size={17} />}
      size="md"
      onClose={onClose}
      footer={pie}
    >
      <div className="space-y-3">
        <AvisoError mensaje={error || errorEnvio} />
        {cargando && <SkeletonLineas lineas={3} />}
        {!cargando && pagos.length === 0 && !puedeRegistrarCuota && (
          <p className="text-sm text-slate-400">Esta cotización no tiene consignaciones registradas.</p>
        )}
        {!cargando && puedeRegistrarCuota && !porRevisar && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
              Cuota inicial del crédito: <strong>{cotizacion.cuotaInicial}</strong>. Regístrala si el cliente la paga en el
              local (el crédito debe estar aprobado).
            </p>
            <CamposPago pago={cuota} onCambio={setCuota} medios={MEDIOS_PAGO_CLIENTE} />
          </div>
        )}
        {pagos.map((p) => (
          <TarjetaPago key={p.id} pago={p} />
        ))}

        {rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo</span>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="El cliente lo verá y volverá a subir el pago."
              className={`${INPUT} ${BORDER_OK} mt-1.5 resize-none`}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
