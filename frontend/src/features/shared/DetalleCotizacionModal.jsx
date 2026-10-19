import { FileText, Package, Truck, Wrench } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import Modal from '../../components/base/Modal';
import { useDetalle } from '../../hooks/useDetalle';
import { HistorialPagos } from './PagoConsignacion';

/**
 * Detalle integrado de una cotización-pedido.
 *
 * Muestra en una sola tabla las líneas de producto (`detalle_venta`) y las
 * de servicio (`detalle_servicio`), que es lo que pide el caso de uso "ver
 * detalle de la cotización-pedido", junto con la cabecera comercial y el
 * estado de la entrega. La financiación no se repite aquí: cuando el pedido
 * se paga a crédito, esas condiciones viven en la cartera.
 *
 * Si el documento llega sin líneas (desde un listado), se las pide a su
 * `servicio` (cotizacionesService o ventasService).
 */
export default function DetalleCotizacionModal({ cotizacion: inicial, servicio, onClose }) {
  const { documento: cotizacion, cargando, error } = useDetalle(inicial, servicio);
  const lineas = cotizacion.detalle ?? [];
  const productos = lineas.filter((l) => l.tipo !== 'servicio').length;
  const serviciosContados = lineas.length - productos;

  return (
    <Modal
      title="Detalle de la cotización-pedido"
      subtitle={`${cotizacion.id} · ${cotizacion.cliente ?? ''}`}
      icon={<FileText size={17} />}
      size="lg"
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          Cerrar
        </button>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={error} />

        {/* ---- Cabecera comercial ---- */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Fecha', valor: cotizacion.fecha },
            { label: 'Método de pago', valor: cotizacion.metodoPago },
            { label: 'Estado', valor: cotizacion.estado },
            { label: 'Entrega', valor: cotizacion.estadoEntrega },
          ].map(({ label, valor }) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{valor || '—'}</p>
            </div>
          ))}
        </section>

        {/* ---- Productos y servicios en una sola tabla ---- */}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Detalle
            </span>
            <Badge>{productos} productos</Badge>
            <Badge>{serviciosContados} servicios</Badge>
          </div>

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
                  <tr
                    key={`${cotizacion.id}-${i}`}
                    className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                            l.tipo === 'servicio'
                              ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                              : 'bg-amber-400/15 text-amber-500 dark:text-amber-400'
                          }`}
                        >
                          {l.tipo === 'servicio' ? <Wrench size={12} /> : <Package size={12} />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {l.medida}
                            {l.solicitud ? ` · ${l.solicitud}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{l.cantidad}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{l.unitario}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
                      {l.subtotal}
                    </td>
                  </tr>
                ))}

                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      {cargando ? 'Cargando las líneas…' : 'La cotización no tiene líneas registradas.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Entrega y total ---- */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Truck size={14} className="text-amber-500 dark:text-amber-400" />
            {cotizacion.direccionEntrega || 'Sin dirección de despacho'}
          </span>
          <span className="text-right">
            <span className="block text-2xl font-bold text-slate-900 dark:text-white">{cotizacion.total}</span>
            {/* Los servicios se pagan aparte, pero suman al valor de la cotización */}
            {cotizacion.conServicios && (
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Productos {cotizacion.totalProductos} + servicios {cotizacion.totalServicios}
              </span>
            )}
          </span>
        </section>

        {/* ---- Pago de contado: la consignación y su historial ---- */}
        <HistorialPagos pagos={cotizacion.pagos} />

        {cotizacion.motivoCancelacion && (
          <p className="rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
            Motivo de la cancelación: {cotizacion.motivoCancelacion}
          </p>
        )}
      </div>
    </Modal>
  );
}
