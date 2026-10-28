import { useState } from 'react';
import { BadgeCheck, Ban, Eye, FileDown, HandCoins, Receipt, Signature } from 'lucide-react';
import Badge from '../../../components/base/Badge';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import MotivoModal from '../../../components/base/MotivoModal';
import {
  estadosCotizacion,
  ESTADO_COTIZACION_COMPLETADA,
  FLUJO_ESTADOS_COTIZACION,
  estadosEntrega,
  ESTADOS_PAGO,
  ETAPAS_COTIZACION,
  metodosPago,
} from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { cotizacionesService, proveedoresService, ventasService } from '../../../services';
import EstadoEntrega from '../shared/EstadoEntrega';
import NuevoPedidoModal from './NuevoPedidoModal';
import PagosCotizacionModal from './PagosCotizacionModal';
import ComprobanteVentaModal from '../../shared/ComprobanteVentaModal';
import DetalleCotizacionModal from '../../shared/DetalleCotizacionModal';
import AceptarCotizacionModal from '../../shared/AceptarCotizacionModal';
import EmitirCotizacionModal from './EmitirCotizacionModal';
import { fechaISO } from '../../../utils/formato';

// Cotización-pedido, en etapas (columna "Etapa"):
//   Solicitud → el cliente (o el asesor) pidió llantas: "Confirmar precios"
//               registra el costo del proveedor y el precio de venta y emite
//   Emitida   → cotización formal, vigente 8 días; se descarga en PDF y el
//               cliente la acepta (o el asesor por él: "Registrar aceptación")
//   Vencida   → no se aceptó a tiempo: se vuelve a confirmar y emitir
//   Aceptada  → ya es un pedido: sigue el flujo de estados y entrega
// Si es a crédito, se aprueba desde "Solicitudes de crédito". Al pasar a
// "Completada" la API genera la venta.
//
// De contado, la cotización lleva la consignación del cliente: mientras está
// pendiente de confirmación la fila se resalta en amarillo y no se puede
// cambiar nada; si se desaprueba, queda atenuada hasta que el cliente suba
// otro pago. El asesor la revisa en "Ver pago".

/**
 * ¿El pago frena la cotización? Sigue en "Pendiente" hasta que todo esté
 * aprobado: la consignación (o la cuota inicial) y cada servicio.
 */
const bloqueada = (row) => Boolean(row.estadoPago) && row.estadoPago !== 'Aprobado';

/** Fecha en el formato estándar AAAA-MM-DD */
const fechaCorta = (f) => fechaISO(f);

/** Se puede (re)emitir mientras el cliente no la acepte y siga pendiente. */
const emitible = (row) => row.estado === 'Pendiente' && ['Solicitud', 'Emitida', 'Vencida'].includes(row.etapa);

const columns = [
  // Fecha y etapa van debajo del número: así la tabla cabe sin desplazarse de lado
  {
    key: 'id',
    label: 'Nº Cotización / Etapa',
    render: (row) => (
      <span className="flex flex-col items-start gap-1">
        <span className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{row.id}</span>
        <span className="whitespace-nowrap text-[11px] text-slate-400">{row.fecha}</span>
        <Badge>{row.etapa}</Badge>
        {row.etapa === 'Solicitud' && <span className="text-[10px] font-medium text-amber-600">Precios por confirmar</span>}
        {row.estado === 'Pendiente' && row.serviciosSinPrecio > 0 && (
          <span className="text-[10px] font-medium text-amber-600" title="Asígnalo en Solicitudes de servicio">
            Reencauche sin precio
          </span>
        )}
        {['Emitida', 'Vencida'].includes(row.etapa) && (
          <span className="text-[10px] text-slate-400">Vence {fechaCorta(row.venceEn)}</span>
        )}
      </span>
    ),
  },
  { key: 'cliente', label: 'Cliente' },
  {
    key: 'metodoPago',
    label: 'Método de pago',
    render: (row) => row.metodoPago || <span className="text-xs text-slate-400">Al aceptar</span>,
  },
  // Precios confirmados × cantidad (más el interés si es a crédito) y el
  // valor de los servicios: lo calcula la API, nadie lo escribe a mano
  {
    key: 'total',
    label: 'Total',
    render: (row) => (row.etapa === 'Solicitud' ? <span className="text-xs text-amber-600">Por confirmar</span> : row.total),
  },
  {
    // Pendiente / Aprobado / Rechazado: la consignación de contado o, a
    // crédito, la solicitud que revisa la cuota inicial
    key: 'estadoPago',
    label: 'Estado de pago',
    render: (row) =>
      row.estadoPago ? <Badge>{row.estadoPago}</Badge> : <span className="text-xs text-slate-400">—</span>,
  },
  { key: 'estado', label: 'Estado' },
  {
    key: 'estadoEntrega',
    label: 'Entrega',
    // La entrega se mueve con la cotización "Completada" (compra recibida y
    // reencauches terminados); antes solo se ve
    render: (row, { update }) => <EstadoEntrega row={row} update={row.estado === 'Completada' ? update : undefined} />,
  },
];

/**
 * Formulario de edición y detalle (la creación usa NuevoPedidoModal).
 * Cliente, fecha y método de pago no cambian después de creada: de ellos
 * dependen los totales, así que solo se muestran.
 */
function seccionesFormulario(nombresProveedores) {
  return [
    {
      title: 'Datos de la cotización',
      fields: [
        { key: 'cliente', label: 'Cliente', soloLectura: true },
        { key: 'fecha', label: 'Fecha', soloLectura: true },
        { key: 'metodoPago', label: 'Método de pago', soloLectura: true },
        { key: 'estado', label: 'Estado', type: 'select', options: estadosCotizacion, only: ['edit', 'view'] },
      ],
    },
    {
      title: 'Entrega',
      fields: [
        { key: 'direccionEntrega', label: 'Dirección de despacho', span: 2, required: true },
        { key: 'estadoEntrega', label: 'Estado de la entrega', type: 'select', options: estadosEntrega, only: ['edit', 'view'] },
        {
          key: 'motivoCancelacion',
          label: 'Motivo de la cancelación',
          type: 'textarea',
          span: 2,
          only: ['edit', 'view'],
          hint: 'Obligatorio si la entrega se cancela.',
        },
      ],
    },
  ];
}

export default function PedidosCotizacionPage() {
  const [comprobanteDe, setComprobanteDe] = useState(null);
  const [detalleDe, setDetalleDe] = useState(null);
  // Cotización abierta en "Ver pago"
  const [pagosDe, setPagosDe] = useState(null);
  // Cotización abierta en "Confirmar precios" y en "Registrar aceptación"
  const [emitiendo, setEmitiendo] = useState(null);
  const [aceptando, setAceptando] = useState(null);
  const [errorPdf, setErrorPdf] = useState('');
  // Cotización que se va a cancelar (se pide el motivo; no se borra)
  const [cancelando, setCancelando] = useState(null);

  const descargarPdf = (row) => {
    setErrorPdf('');
    cotizacionesService.descargarPdf(row.id).catch((e) => setErrorPdf(e.message));
  };

  const cotizaciones = useRecurso(cotizacionesService);

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Pedidos-Cotización']} />
      <DataTable
        title="Pedidos-Cotización"
        columns={columns}
        data={cotizaciones.filas}
        cargando={cotizaciones.cargando}
        error={cotizaciones.error}
        onRecargar={cotizaciones.recargar}
        // NuevoPedidoModal entrega la solicitud (cliente, llantas y servicios)
        onCreate={(datos) => cotizaciones.ejecutar(() => cotizacionesService.crearDesdePanel(datos))}
        onDelete={cotizaciones.eliminar}
        // Cancelarla (Rechazada) pide el motivo antes de enviar
        onStatusChange={(fila, estado) =>
          estado === 'Rechazada'
            ? setCancelando(fila)
            : cotizaciones.ejecutar(() => cotizacionesService.cambiarEstado(fila, estado))
        }
        // Cambios desde las celdas: avanzar la entrega
        onRowUpdate={(fila, cambios) => cotizaciones.ejecutar(() => cotizacionesService.actualizar(fila, cambios))}
        statusKey="estado"
        newLabel="Nueva cotización"
        entityName="cotización"
        titleKey="cliente"
        canView={false}
        statusOptions={estadosCotizacion}
        // Sin aceptar por el cliente, lo único permitido es cancelarla (con motivo)
        statusFlow={(row) => (row.etapa === 'Aceptada' ? FLUJO_ESTADOS_COTIZACION : { [row.estado]: ['Rechazada'] })}
        filters={[
          { key: 'etapa', label: 'Etapa', options: ETAPAS_COTIZACION },
          { key: 'estado', label: 'Estado', options: estadosCotizacion },
          { key: 'estadoEntrega', label: 'Entrega', options: estadosEntrega },
          { key: 'metodoPago', label: 'Método de pago', options: metodosPago },
          { key: 'estadoPago', label: 'Estado de pago', options: ESTADOS_PAGO },
        ]}
        createModal={({ onSubmit, onClose }) => <NuevoPedidoModal onSubmit={onSubmit} onClose={onClose} />}
        // Pago por confirmar: fila amarilla; rechazado: atenuada. En los dos
        // casos no se cambia el estado ni se edita
        rowClassName={(row) =>
          row.pagoEstado === 'En revisión'
            ? 'bg-amber-400/15'
            : row.estadoPago === 'Rechazado'
              ? 'opacity-50'
              : row.etapa === 'Solicitud'
                ? 'bg-amber-400/5'
                : ''
        }
        // El estado no avanza hasta que el cliente acepte la cotización (antes
        // solo se cancela). Con pagos pendientes solo se puede rechazar (la API
        // lo valida); con una consignación por revisar, primero se revisa
        canChangeStatus={(row) => row.pagoEstado !== 'En revisión'}
        canEdit={(row) => !bloqueada(row)}
        // Solo se borra una pendiente; las demás se cancelan (quedan Rechazadas)
        canDelete={(row) => row.estado === 'Pendiente'}
        rowActions={(row) => (
          <>
            <BotonAccion accion="verDetalle" icono={Eye} etiqueta="Ver productos y servicios" tono="acento" onClick={() => setDetalleDe(row)} />
            <BotonAccion accion="emitir"
              icono={BadgeCheck}
              etiqueta={row.etapa === 'Emitida' ? 'Volver a confirmar precios y emitir' : 'Confirmar precios con el proveedor y emitir'}
              tono={row.etapa === 'Emitida' ? 'acento' : 'destacado'}
              deshabilitado={!emitible(row)}
              motivo="Ya fue aceptada o cerrada"
              onClick={() => setEmitiendo(row)}
            />
            <BotonAccion accion="aceptar"
              icono={Signature}
              etiqueta="Registrar la aceptación del cliente (en el local)"
              tono="acento"
              deshabilitado={!(row.etapa === 'Emitida' && row.estado === 'Pendiente')}
              motivo={row.etapa === 'Solicitud' ? 'Primero confirma los precios y emite la cotización' : 'No hay una cotización emitida por aceptar'}
              onClick={() => setAceptando(row)}
            />
            <BotonAccion accion="descargarPdf"
              icono={FileDown}
              etiqueta="Descargar la cotización en PDF"
              tono="acento"
              deshabilitado={!row.emitidaEn}
              motivo="La cotización todavía no se ha emitido"
              onClick={() => descargarPdf(row)}
            />
            <BotonAccion accion="revisarPago"
              icono={HandCoins}
              etiqueta="Ver pago y consignaciones"
              tono={row.pagoEstado === 'En revisión' ? 'destacado' : 'acento'}
              // A crédito aceptado se abre también para registrar la cuota inicial
              deshabilitado={!row.pagoEstado && !(row.metodoPago === 'Crédito' && row.etapa === 'Aceptada')}
              motivo="Todavía no hay pagos registrados"
              onClick={() => setPagosDe(row)}
            />
            {/* Se cancela sin borrarla, solo mientras no esté aprobada (pagada) */}
            <BotonAccion accion="cambiarEstado"
              icono={Ban}
              etiqueta="Cancelar la cotización"
              tono="peligro"
              deshabilitado={row.estado !== 'Pendiente'}
              motivo={row.estado === 'Rechazada' ? 'Ya está cancelada' : 'Ya fue aprobada: no se puede cancelar'}
              onClick={() => setCancelando(row)}
            />
            {/* El comprobante solo se emite con la cotización cerrada */}
            <BotonAccion accion="verDetalle"
              icono={Receipt}
              etiqueta="Generar comprobante de venta"
              tono="exito"
              deshabilitado={row.estado !== ESTADO_COTIZACION_COMPLETADA}
              motivo="La cotización todavía no está completada"
              onClick={() => setComprobanteDe(row)}
            />
          </>
        )}
      />

      {cancelando && (
        <MotivoModal
          title="Cancelar la cotización"
          message="Queda como Rechazada con su motivo; no se borra."
          record={{ title: `${cancelando.id} · ${cancelando.cliente}`, subtitle: cancelando.total }}
          label="Motivo de la cancelación"
          confirmLabel="Cancelar cotización"
          onConfirm={async (motivo) => {
            await cotizacionesService.actualizar(cancelando, { estado: 'Rechazada', motivoCancelacion: motivo });
            await cotizaciones.recargar();
          }}
          onClose={() => setCancelando(null)}
        />
      )}

      {errorPdf && (
        <p role="alert" className="mt-3 rounded-lg border border-red-400/50 bg-red-500/5 px-3 py-2 text-sm text-red-600">
          {errorPdf}
        </p>
      )}

      {emitiendo && (
        <EmitirCotizacionModal
          cotizacion={emitiendo}
          onEmitida={cotizaciones.recargar}
          onClose={() => setEmitiendo(null)}
        />
      )}

      {aceptando && (
        <AceptarCotizacionModal
          cotizacion={aceptando}
          onAceptada={cotizaciones.recargar}
          onClose={() => setAceptando(null)}
        />
      )}

      {pagosDe && (
        <PagosCotizacionModal
          cotizacion={pagosDe}
          onResuelto={cotizaciones.recargar}
          onClose={() => setPagosDe(null)}
        />
      )}

      {detalleDe && (
        <DetalleCotizacionModal
          cotizacion={detalleDe}
          servicio={cotizacionesService}
          onDescargarPdf={(c) => cotizacionesService.descargarPdf(c.id)}
          onClose={() => setDetalleDe(null)}
        />
      )}
      {comprobanteDe && (
        <ComprobanteVentaModal
          venta={comprobanteDe}
          servicio={cotizacionesService}
          onDescargarPdf={(c) => ventasService.descargarPdf(c.venta)}
          onClose={() => setComprobanteDe(null)}
        />
      )}
    </div>
  );
}
