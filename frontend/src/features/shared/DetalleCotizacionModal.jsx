import { useState } from 'react';
import { CalendarClock, FileDown, FileText, Package, ReceiptText, Wrench } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import { DetalleAviso, DetalleDatos, DetalleImagen, DetalleLineas, DetalleResumen, DetalleSeccion } from '../../components/base/Detalle';
import Modal from '../../components/base/Modal';
import { useDetalle } from '../../hooks/useDetalle';
import { VIGENCIA_COTIZACION_DIAS } from '../../constantes';
import { HistorialPagos } from './PagoConsignacion';
import { fechaISO } from '../../utils/formato';

/** Fecha en el formato estándar AAAA-MM-DD */
const fechaCorta = (f) => fechaISO(f);

/**
 * Detalle integrado de una cotización-pedido.
 *
 * Muestra en una sola lista las líneas de producto (`detalle_venta`) y las
 * de servicio (`detalle_servicio`), que es lo que pide el caso de uso "ver
 * detalle de la cotización-pedido", junto con la cabecera comercial y el
 * estado de la entrega. La financiación no se repite aquí: cuando el pedido
 * se paga a crédito, esas condiciones viven en la cartera. Abierto desde
 * Ventas también muestra los datos propios de la venta.
 *
 * Si el documento llega sin líneas (desde un listado), se las pide a su
 * `servicio` (cotizacionesService o ventasService). Para una cotización
 * muestra también su etapa y vigencia y, si ya es formal, el botón para
 * descargarla en PDF (`onDescargarPdf`).
 */
export default function DetalleCotizacionModal({ cotizacion: inicial, servicio, onClose, onDescargarPdf }) {
  const { documento: cotizacion, cargando, error } = useDetalle(inicial, servicio);
  const [errorPdf, setErrorPdf] = useState('');
  const [descargando, setDescargando] = useState(false);
  const esCotizacion = Boolean(cotizacion.etapa);
  // A crédito, la venta vale lo cobrado: la suma de los abonos confirmados
  const ventaACredito = !esCotizacion && Boolean(cotizacion.credito);

  const descargar = () => {
    setErrorPdf('');
    setDescargando(true);
    Promise.resolve(onDescargarPdf(cotizacion))
      .catch((e) => setErrorPdf(e.message))
      .finally(() => setDescargando(false));
  };
  const lineas = cotizacion.detalle ?? [];
  const productos = lineas.filter((l) => l.tipo !== 'servicio').length;
  const serviciosContados = lineas.length - productos;

  return (
    <Modal
      title={esCotizacion ? 'Detalle de la cotización-pedido' : 'Detalle de la venta'}
      subtitle={`${cotizacion.id} · ${cotizacion.cliente ?? ''}`}
      icon={<FileText size={17} />}
      size="lg"
      onClose={onClose}
      footer={(close) => (
        <>
          {onDescargarPdf && cotizacion.emitidaEn && (
            <button
              type="button"
              onClick={descargar}
              disabled={descargando}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
            >
              <FileDown size={16} /> {descargando ? 'Generando…' : 'Descargar PDF'}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Cerrar
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        <AvisoError mensaje={error || errorPdf} />

        {/* ---- Lo primero: cuánto vale y en qué estado está ---- */}
        <DetalleResumen
          etiqueta={ventaACredito ? 'Total cobrado (abonos confirmados)' : 'Total'}
          valor={cotizacion.total}
          // Los servicios se pagan aparte, pero suman al valor de la cotización
          nota={cotizacion.conServicios ? `Productos ${cotizacion.totalProductos} + servicios ${cotizacion.totalServicios}` : null}
          estado={cotizacion.estado}
        />

        {/* ---- Vigencia de la cotización ---- */}
        {esCotizacion && cotizacion.etapa === 'Solicitud' && (
          <DetalleAviso icono={<CalendarClock size={15} />}>
            Solicitud con precios por confirmar con el proveedor. Todavía no es una cotización formal: la vigencia empieza
            cuando se emita.
          </DetalleAviso>
        )}
        {cotizacion.motivoCancelacion && (
          <DetalleAviso tono="peligro">Motivo de la cancelación: {cotizacion.motivoCancelacion}</DetalleAviso>
        )}

        {/* ---- Cabecera comercial ---- */}
        <DetalleDatos
          columnas={4}
          datos={[
            { etiqueta: 'Cliente', valor: cotizacion.cliente },
            { etiqueta: 'Fecha', valor: cotizacion.fecha },
            { etiqueta: 'Método de pago', valor: cotizacion.metodoPago || (esCotizacion ? 'Al aceptar' : '') },
            { etiqueta: 'Entrega', valor: cotizacion.estadoEntrega },
            esCotizacion && cotizacion.emitidaEn && { etiqueta: 'Etapa', valor: <Badge>{cotizacion.etapa}</Badge> },
            esCotizacion && cotizacion.emitidaEn && { etiqueta: 'Emitida', valor: fechaCorta(cotizacion.emitidaEn) },
            esCotizacion && cotizacion.emitidaEn && { etiqueta: 'Vence', valor: fechaCorta(cotizacion.venceEn) },
            esCotizacion && cotizacion.emitidaEn && { etiqueta: 'Vigencia', valor: `${VIGENCIA_COTIZACION_DIAS} días calendario` },
            // Datos propios de una venta
            !esCotizacion && { etiqueta: 'Cotización', valor: cotizacion.cotizacion || 'Venta directa' },
            !esCotizacion && { etiqueta: 'Crédito', valor: cotizacion.credito },
            !esCotizacion && { etiqueta: 'Proveedor', valor: cotizacion.proveedor },
            !esCotizacion && { etiqueta: 'Tercero', valor: cotizacion.tercero },
            !esCotizacion && cotizacion.metodoPago === 'Crédito' && { etiqueta: 'Interés', valor: cotizacion.interes },
            !esCotizacion && cotizacion.metodoPago === 'Crédito' && { etiqueta: 'Cuota inicial', valor: cotizacion.cuotaInicial },
            (esCotizacion || cotizacion.direccionEntrega) && { etiqueta: 'Dirección de despacho', valor: cotizacion.direccionEntrega, ancho: true },
          ]}
        />

        {/* ---- Productos y servicios en una sola lista ---- */}
        <DetalleSeccion
          titulo="Productos y servicios"
          icono={<Package size={15} />}
          accion={
            <span className="flex gap-1.5">
              <Badge>{productos} productos</Badge>
              <Badge>{serviciosContados} servicios</Badge>
            </span>
          }
        >
          <DetalleLineas
            lineas={lineas}
            cargando={cargando}
            vacio={esCotizacion ? 'La cotización no tiene líneas registradas.' : 'Esta venta no tiene líneas: se registró por su valor total.'}
            notaDe={(l) => (
              <>
                {/* Solo el personal recibe con qué proveedor(es) se verificó */}
                {l.tipo !== 'servicio' && l.costoConfirmadoEn && l.proveedoresLinea?.length > 0 ? (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    Compra repartida: {l.proveedoresLinea.map((p) => `${p.proveedor} (${p.cantidad})`).join(' · ')}
                  </p>
                ) : (
                  l.tipo !== 'servicio' && l.costoConfirmadoEn && (
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Precio verificado con {l.proveedorLinea}
                    </p>
                  )
                )}
                {l.tipo !== 'servicio' && esCotizacion && l.precioSugerido !== null && !l.costoConfirmadoEn && (
                  <p className="text-[11px] font-medium text-amber-600">Precio pendiente de verificar con el proveedor</p>
                )}
              </>
            )}
          />
        </DetalleSeccion>

        {/* ---- Reencauches: estado, revisión de la carcasa, garantía y fotos ---- */}
        {lineas.filter((l) => l.solicitudDatos).map((l) => {
          const s = l.solicitudDatos;
          return (
            <DetalleSeccion key={s.id} titulo={`Reencauche ${s.id}`} icono={<Wrench size={15} />} accion={<Badge>{s.estado}</Badge>}>
              <div className="space-y-3">
                <DetalleDatos
                  datos={[
                    { etiqueta: 'Medidas', valor: s.medidas },
                    { etiqueta: 'Cantidad', valor: `${s.cantidad} llantas` },
                    { etiqueta: 'Carcasa', valor: s.estadoEvidencia },
                    // Cancelado ya no se cobra: solo queda el motivo (abajo)
                    s.estado !== 'Cancelado' && { etiqueta: 'Garantía', valor: s.estadoEvidencia === 'Apta' ? s.garantia : 'Por definir' },
                    s.estado !== 'Cancelado' && { etiqueta: 'Valor', valor: s.precioTexto },
                    s.estado !== 'Cancelado' && { etiqueta: 'Pago', valor: s.pagoEstado },
                    s.observacionRevision && { etiqueta: 'Revisión de la carcasa', valor: s.observacionRevision, ancho: true },
                    s.descripcion && { etiqueta: 'Descripción', valor: s.descripcion, ancho: true },
                  ]}
                />
                {s.estado === 'Cancelado' && (
                  <DetalleAviso tono="peligro">Reencauche cancelado. Motivo: {s.motivoCancelacion || 'sin motivo registrado'}</DetalleAviso>
                )}
                {s.fotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {s.fotos.map((foto, i) => (
                      <a key={i} href={foto} target="_blank" rel="noreferrer">
                        <img src={foto} alt={`Foto ${i + 1} de la llanta`} className="h-16 w-16 rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </DetalleSeccion>
          );
        })}

        {/* ---- Soporte del pago de una venta directa ---- */}
        {cotizacion.comprobantePago && (
          <DetalleSeccion titulo="Comprobante de pago" icono={<ReceiptText size={15} />}>
            <DetalleImagen src={cotizacion.comprobantePago} alt={`Comprobante de pago de ${cotizacion.id}`} />
          </DetalleSeccion>
        )}

        {/* ---- La consignación y su historial ---- */}
        <HistorialPagos pagos={cotizacion.pagos} />
      </div>
    </Modal>
  );
}
