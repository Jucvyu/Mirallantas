import { useState } from 'react';
import { Check, HandCoins, Package, ReceiptText, Wrench, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useDetalle } from '../../../hooks/useDetalle';
import { useEnvio } from '../../../hooks/useEnvio';
import { solicitudesCreditoService } from '../../../services';

/**
 * Detalle de una solicitud de crédito.
 *
 * Muestra lo que el asesor necesita para decidir: el detalle de la
 * cotización-pedido (productos y servicios), cuánto se financia y la
 * consignación de la cuota inicial. Si sigue pendiente, desde aquí mismo
 * se aprueba o no (no aprobarla pide el motivo).
 *
 *   Aprobar     → se abre el crédito en la cartera del cliente.
 *   No aprobar  → la cotización se rechaza y las llantas vuelven al stock.
 */
export default function DetalleSolicitudCreditoModal({ solicitud: inicial, onResuelta, onClose }) {
  const { documento: solicitud, cargando, error } = useDetalle(inicial, solicitudesCreditoService);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();
  const lineas = solicitud.detalle ?? [];
  const pendiente = solicitud.estado === 'Pendiente';

  const aprobar = (cerrar) =>
    enviar(async () => {
      await solicitudesCreditoService.cambiarEstado(solicitud, 'Aprobada');
      await onResuelta?.();
    }, cerrar);

  const rechazar = (cerrar) =>
    enviar(async () => {
      await solicitudesCreditoService.rechazar(solicitud, motivo.trim());
      await onResuelta?.();
    }, cerrar);

  const pie = (cerrar) =>
    pendiente ? (
      <>
        {rechazando ? (
          <>
            <button
              type="button"
              onClick={() => setRechazando(false)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => rechazar(cerrar)}
              disabled={enviando || !motivo.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              <X size={15} /> Confirmar: no aprobar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setRechazando(true)}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <X size={15} /> No aprobar
            </button>
            <button
              type="button"
              onClick={() => aprobar(cerrar)}
              disabled={enviando || cargando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <Check size={15} /> {enviando ? 'Guardando…' : 'Aprobar crédito'}
            </button>
          </>
        )}
      </>
    ) : (
      <button
        type="button"
        onClick={cerrar}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
      >
        Cerrar
      </button>
    );

  return (
    <Modal
      title="Detalle de la solicitud de crédito"
      subtitle={`${solicitud.id} · ${solicitud.cliente ?? ''}`}
      icon={<HandCoins size={17} />}
      size="lg"
      onClose={onClose}
      footer={pie}
    >
      <div className="space-y-6">
        <AvisoError mensaje={error || errorEnvio} />

        {/* ---- Resumen ---- */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Cotización', valor: solicitud.cotizacion || 'Sin cotización' },
            { label: 'Total del pedido', valor: solicitud.totalCotizacion || '—' },
            { label: 'Monto a financiar', valor: solicitud.monto },
            { label: 'Plazo', valor: `${solicitud.plazoDias} días` },
          ].map(({ label, valor }) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{valor}</p>
            </div>
          ))}
        </section>
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          Estado: <Badge>{solicitud.estado}</Badge>
          {solicitud.motivo && <span className="text-red-500">· Motivo: {solicitud.motivo}</span>}
        </p>

        {/* ---- Detalle de la cotización ---- */}
        {solicitud.cotizacion && (
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Detalle del pedido
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-brand-navy-900">
                  <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <th className="px-4 py-2.5">Descripción</th>
                    <th className="px-4 py-2.5 text-center">Cant.</th>
                    <th className="px-4 py-2.5 text-right">Unitario</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i} className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          {l.tipo === 'servicio' ? (
                            <Wrench size={13} className="text-blue-500" />
                          ) : (
                            <Package size={13} className="text-amber-500" />
                          )}
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</span>
                          <span className="text-xs text-slate-400">{l.medida}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{l.cantidad}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{l.unitario}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{l.subtotal}</td>
                    </tr>
                  ))}
                  {lineas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                        {cargando ? 'Cargando el detalle…' : 'Sin líneas registradas.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ---- Consignación de la cuota inicial ---- */}
        {solicitud.cotizacion && (
          <section className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <ReceiptText size={15} className="text-amber-500" /> Cuota inicial pagada
            </p>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Valor:</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-100">{solicitud.cuotaInicial || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Medio de pago:</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-100">{solicitud.cuotaInicialMedio || '—'}</dd>
                </div>
              </dl>
              {solicitud.comprobante ? (
                <a href={solicitud.comprobante} target="_blank" rel="noreferrer" title="Abrir la consignación completa">
                  <img
                    src={solicitud.comprobante}
                    alt="Consignación de la cuota inicial"
                    className="max-h-64 w-full rounded-lg border border-slate-200 object-contain dark:border-white/10 sm:w-56"
                  />
                </a>
              ) : (
                <p className="text-xs text-slate-400">
                  {solicitud.cuotaInicialMedio === 'Efectivo' ? 'Pago en efectivo: sin consignación.' : 'Sin consignación adjunta.'}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ---- Motivo para no aprobar ---- */}
        {pendiente && rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo para no aprobarla</span>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
              placeholder="Explícale al cliente por qué no se aprobó."
              className={`${INPUT} ${BORDER_OK} mt-1.5 resize-none`}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
