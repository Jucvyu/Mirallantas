import { useState } from 'react';
import { Check, Eye, HandCoins, Package, ReceiptText, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import { DetalleAviso, DetalleDatos, DetalleImagen, DetalleLineas, DetalleResumen, DetalleSeccion } from '../../../components/base/Detalle';
import Modal from '../../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import { useDetalle } from '../../../hooks/useDetalle';
import { useEnvio } from '../../../hooks/useEnvio';
import { cotizacionesService, solicitudesCreditoService } from '../../../services';
import DetalleCotizacionModal from '../../shared/DetalleCotizacionModal';
import { MAX_TEXTO } from '../../../utils/validaciones';
import { usePrivilegio } from '../../../hooks/usePrivilegio';

/**
 * Detalle de una solicitud de crédito.
 *
 * Muestra lo que el asesor necesita para decidir: el detalle de la
 * cotización-pedido (productos y servicios), cuánto se financia y la
 * consignación de la cuota inicial. "Ver cotización" abre el detalle completo
 * de la cotización sin salir de aquí. Si sigue pendiente, desde aquí mismo
 * se aprueba o no (no aprobarla pide el motivo).
 *
 *   Aprobar     → se abre el crédito en la cartera del cliente.
 *   No aprobar  → la cotización se rechaza.
 */
export default function DetalleSolicitudCreditoModal({ solicitud: inicial, onResuelta, onClose }) {
  const { documento: solicitud, cargando, error } = useDetalle(inicial, solicitudesCreditoService);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  // Detalle completo de la cotización, abierto encima de este modal
  const [viendoCotizacion, setViendoCotizacion] = useState(false);
  const { enviando, errorEnvio, enviar } = useEnvio();
  const lineas = solicitud.detalle ?? [];
  // Aprobar o rechazar solo con el privilegio del rol (nivel 3)
  const puede = usePrivilegio();
  const pendiente = solicitud.estado === 'Pendiente' && puede('aprobarCredito');

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
      <div className="space-y-5">
        <AvisoError mensaje={error || errorEnvio} />

        <DetalleResumen
          etiqueta="Monto a financiar"
          valor={solicitud.monto}
          nota={`A ${solicitud.plazoDias} días · ${solicitud.fecha ?? ''}`}
          estado={solicitud.estado}
        />

        {solicitud.motivo && <DetalleAviso tono="peligro">Motivo del rechazo: {solicitud.motivo}</DetalleAviso>}

        <DetalleDatos
          datos={[
            { etiqueta: 'Cliente', valor: solicitud.cliente },
            { etiqueta: 'Cotización', valor: solicitud.cotizacion || 'Sin cotización' },
            { etiqueta: 'Total del pedido', valor: solicitud.totalCotizacion },
          ]}
        />

        {/* ---- Detalle de la cotización ---- */}
        {solicitud.cotizacion && (
          <DetalleSeccion
            titulo="Detalle del pedido"
            icono={<Package size={15} />}
            accion={
              <button
                type="button"
                onClick={() => setViendoCotizacion(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 px-2.5 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-400/10 dark:text-amber-400"
              >
                <Eye size={13} /> Ver cotización {solicitud.cotizacion}
              </button>
            }
          >
            <DetalleLineas lineas={lineas} cargando={cargando} />
          </DetalleSeccion>
        )}

        {/* ---- Consignación de la cuota inicial ---- */}
        {solicitud.cotizacion && (
          <DetalleSeccion titulo="Cuota inicial" icono={<ReceiptText size={15} />}>
            <div className="space-y-3">
              <DetalleDatos
                datos={[
                  { etiqueta: 'Valor', valor: solicitud.cuotaInicial },
                  { etiqueta: 'Método de pago', valor: solicitud.cuotaInicialMedio },
                ]}
              />
              <DetalleImagen
                src={solicitud.comprobante}
                alt="Consignación de la cuota inicial"
                vacio={
                  solicitud.cuotaInicialMedio === 'Efectivo'
                    ? 'Pago en efectivo: sin consignación.'
                    : solicitud.cuotaInicialMedio
                      ? 'Sin consignación adjunta.'
                      : 'La cuota inicial todavía no se ha pagado.'
                }
              />
            </div>
          </DetalleSeccion>
        )}

        {/* ---- Motivo para no aprobar ---- */}
        {pendiente && rechazando && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Motivo para no aprobarla</span>
            <textarea
              maxLength={MAX_TEXTO}
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
      {viendoCotizacion && (
        <DetalleCotizacionModal
          cotizacion={{ id: solicitud.cotizacion }}
          servicio={cotizacionesService}
          onDescargarPdf={(c) => cotizacionesService.descargarPdf(c.id)}
          onClose={() => setViendoCotizacion(false)}
        />
      )}
    </Modal>
  );
}
