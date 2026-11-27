import { useMemo, useState } from 'react';
import { Eye, Receipt, Wallet } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import PageHeader from '../../../components/base/PageHeader';
import DataTable from '../../../components/base/DataTable';
import { columnaCliente } from '../../../components/base/celdaCliente';
import { CUOTA_INICIAL_PORCENTAJE, cuotaMinimaDe, metodosPago } from '../../../constantes';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesSeleccionablesService, proveedoresService, tercerosService, ventasService } from '../../../services';
import { formatCOP, hoyISO, parseCOP } from '../../../utils/formato';
import { opcionesClientes, opcionesEmpresas } from '../../../utils/opciones';
import ComprobanteVentaModal from '../../shared/ComprobanteVentaModal';
import DetalleCotizacionModal from '../../shared/DetalleCotizacionModal';
import HistorialAbonosModal from '../cartera/HistorialAbonosModal';

/**
 * Venta a crédito: la cuota inicial cubre al menos el 30 % del total (el
 * 70 % restante se financia); de contado se paga el 100 %. La API vuelve a
 * comprobarlo al guardar.
 */
function validarCuotaInicial(values) {
  if (values.metodoPago !== 'Crédito') return {};
  const total = parseCOP(values.total);
  const inicial = parseCOP(values.cuotaInicial);
  if (!total) return {};
  const minimo = cuotaMinimaDe(total);
  if (inicial < minimo) {
    return {
      cuotaInicial: `La cuota inicial debe ser de al menos $ ${minimo.toLocaleString('es-CO')} (${CUOTA_INICIAL_PORCENTAJE} % del total).`,
    };
  }
  if (inicial >= total) return { cuotaInicial: 'Si se paga todo de una vez, registra la venta de contado.' };
  return {};
}

/**
 * Un campo que se llena al crear la venta y después solo se consulta: se
 * convierte en dos, uno editable al crear y otro de solo lectura al editar.
 */
function soloAlCrear(campo) {
  return [
    { ...campo, only: 'create' },
    { ...campo, type: campo.type === 'select' ? undefined : campo.type, only: ['edit', 'view'], soloLectura: true },
  ];
}

// Tabla `venta`. La venta nace sola cuando la cotización llega a
// "Completada" (con todas sus líneas), y también puede registrarse una
// venta directa con su valor total. A crédito, la venta vale lo cobrado: la
// suma de los abonos confirmados. El estado y la entrega son del
// pedido-cotización: aquí no se muestran (solo se marca la venta anulada).
const columns = [
  // La fecha va debajo del número: así la tabla cabe sin desplazarse de lado
  {
    key: 'id',
    label: 'Nº Venta / Fecha',
    render: (row) => (
      <span className="flex flex-col">
        <span className="whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{row.id}</span>
        <span className="whitespace-nowrap text-[11px] text-slate-400">{row.fecha}</span>
        {row.estado === 'Anulada' && <span className="text-[11px] font-semibold text-red-500">Anulada</span>}
      </span>
    ),
  },
  columnaCliente(),
  { key: 'metodoPago', label: 'Método de pago' },
  { key: 'cotizacion', label: 'Origen', render: (row) => row.origen, exportar: (row) => row.origen },
  // Vendido = lo pactado; cobrado = lo que ya entró; saldo = lo que falta (solo a crédito)
  { key: 'totalVendido', label: 'Vendido', render: (row) => <span className="font-semibold tabular-nums">{row.totalVendido}</span> },
  { key: 'cobrado', label: 'Cobrado', render: (row) => <span className="tabular-nums">{row.cobrado}</span> },
  {
    key: 'saldo',
    label: 'Saldo',
    render: (row) =>
      row.saldoValor > 0 ? (
        <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{row.saldo}</span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
];

function seccionesFormulario({ clientes, proveedores, terceros }) {
  return [
    {
      title: 'Datos de la venta',
      fields: [
        // Buscador por nombre o documento: guarda el id real del cliente
        {
          key: 'clienteId',
          label: 'Cliente',
          type: 'buscador',
          required: true,
          options: opcionesClientes(clientes),
          placeholderBusqueda: 'Nombre o número de documento',
          emptyLabel: 'cliente',
          only: 'create',
        },
        { key: 'cliente', label: 'Cliente', only: ['edit', 'view'], soloLectura: true },
        {
          key: 'proveedorId',
          label: 'Proveedor',
          type: 'buscador',
          options: opcionesEmpresas(proveedores),
          placeholderBusqueda: 'Razón social o NIT',
          emptyLabel: 'proveedor',
          hint: 'Proveedor que surtió los productos vendidos.',
        },
        ...soloAlCrear({ key: 'fecha', label: 'Fecha', type: 'date', required: true }),
        ...soloAlCrear({ key: 'metodoPago', label: 'Método de pago', type: 'select', required: true, options: metodosPago }),
        {
          key: 'terceroId',
          label: 'Tercero (reencauchadora)',
          type: 'buscador',
          options: opcionesEmpresas(terceros),
          placeholderBusqueda: 'Razón social o NIT',
          emptyLabel: 'tercero',
          hint: 'Solo si la venta incluye un servicio de reencauche.',
        },
      ],
    },
    {
      title: 'Valores',
      fields: [
        ...soloAlCrear({ key: 'total', label: 'Valor total (COP)', type: 'money', required: true, placeholder: '1.968.000' }),
        ...soloAlCrear({ key: 'interes', label: 'Interés (COP)', type: 'money', placeholder: '0' }),
        ...soloAlCrear({
          key: 'cuotaInicial',
          label: 'Cuota inicial (COP)',
          type: 'money',
          placeholder: '0',
          hint: `A crédito, al menos el ${CUOTA_INICIAL_PORCENTAJE} % del total (el resto se financia). De contado se paga el 100 %.`,
        }),
      ],
    },
    {
      title: 'Soporte del pago',
      fields: [
        {
          key: 'comprobantePago',
          label: 'Comprobante de pago',
          type: 'image',
          span: 2,
          placeholder: 'Sube el pantallazo de la consignación o el recibo',
          hint: 'Queda adjunto a la venta como respaldo del pago recibido.',
        },
      ],
    },
  ];
}

/** Periodos del resumen de ventas. */
const PERIODOS = [
  { clave: 'hoy', titulo: 'Hoy' },
  { clave: 'mes', titulo: 'Este mes' },
  { clave: 'todo', titulo: 'Todo' },
];

/** ¿La venta (AAAA-MM-DD) cae en el periodo? */
const enPeriodo = (fecha, periodo, hoy) =>
  periodo === 'todo' || (periodo === 'hoy' ? fecha === hoy : String(fecha).slice(0, 7) === hoy.slice(0, 7));

/**
 * Resumen de las ventas del periodo (sin las anuladas):
 *   Vendido      lo que se pactó con los clientes
 *   Cobrado      lo que ya entró de esas ventas (contado + cuotas y abonos confirmados)
 *   Por cobrar   lo que falta de los créditos de esas ventas
 * Un abono que entra después suma a lo cobrado de su venta, no a lo vendido.
 */
function ResumenVentas({ ventas, cargando }) {
  const [periodo, setPeriodo] = useState('mes');
  const hoy = hoyISO();
  const suma = useMemo(() => {
    const delPeriodo = ventas.filter((v) => v.estado !== 'Anulada' && enPeriodo(v.fecha, periodo, hoy));
    return {
      cantidad: delPeriodo.length,
      vendido: delPeriodo.reduce((s, v) => s + (v.totalVendidoValor ?? 0), 0),
      cobrado: delPeriodo.reduce((s, v) => s + (v.cobradoValor ?? 0), 0),
      porCobrar: delPeriodo.reduce((s, v) => s + (v.saldoValor ?? 0), 0),
    };
  }, [ventas, periodo, hoy]);

  const cifras = [
    { titulo: 'Vendido', valor: suma.vendido, nota: `${suma.cantidad} ${suma.cantidad === 1 ? 'venta' : 'ventas'}`, tono: 'text-slate-900 dark:text-white' },
    { titulo: 'Cobrado', valor: suma.cobrado, nota: 'Plata que ya entró', tono: 'text-emerald-600 dark:text-emerald-400' },
    { titulo: 'Por cobrar', valor: suma.porCobrar, nota: 'Saldo de los créditos', tono: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <section aria-label="Resumen de ventas" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-brand-navy-800 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Resumen de ventas</h2>
        <div role="group" aria-label="Periodo" className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
          {PERIODOS.map((p) => (
            <button
              key={p.clave}
              type="button"
              aria-pressed={periodo === p.clave}
              onClick={() => setPeriodo(p.clave)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                periodo === p.clave
                  ? 'bg-amber-400 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {p.titulo}
            </button>
          ))}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cifras.map((c) => (
          <div key={c.titulo} className="min-w-0">
            <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{c.titulo}</dt>
            <dd className={`mt-0.5 text-2xl font-extrabold tabular-nums ${c.tono} ${cargando ? 'opacity-40' : ''}`}>{formatCOP(c.valor)}</dd>
            <dd className="text-[11px] text-slate-400 dark:text-slate-500">{c.nota}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
        Cuenta las ventas hechas en el periodo. Los abonos que llegan después se suman a lo cobrado de su venta.
      </p>
    </section>
  );
}

export default function VentasPage() {
  const [comprobanteDe, setComprobanteDe] = useState(null);
  const [detalleDe, setDetalleDe] = useState(null);
  // Venta a crédito cuyo pago (abonos) se está corrigiendo
  const [abonosDe, setAbonosDe] = useState(null);

  const clientes = useRecurso(clientesSeleccionablesService);
  const proveedores = useRecurso(proveedoresService);
  const terceros = useRecurso(tercerosService);
  const ventas = useRecurso(ventasService);

  // El servicio usa estas listas para enviar los nombres elegidos como ids
  const contexto = { clientes: clientes.filas, proveedores: proveedores.filas, terceros: terceros.filas };

  return (
    <div>
      <PageHeader crumbs={['Inicio', 'Ventas']} />
      <ResumenVentas ventas={ventas.filas} cargando={ventas.cargando} />
      <DataTable
        title="Ventas"
        columns={columns}
        data={ventas.filas}
        cargando={ventas.cargando}
        error={ventas.error}
        onRecargar={ventas.recargar}
        onCreate={(valores) => ventas.crear(valores, contexto)}
        onEdit={(fila, valores) => ventas.editar(fila, valores, contexto)}
        newLabel="Nueva venta"
        formSections={seccionesFormulario({
          clientes: clientes.filas,
          proveedores: proveedores.filas,
          terceros: terceros.filas,
        })}
        entityName="venta"
        titleKey="cliente"
        // El detalle es "Ver detalle y productos"
        canView={false}
        // Una venta no se borra: se anula, y queda en el historial
        canDelete={false}
        formValidate={validarCuotaInicial}
        filters={[
          { key: 'metodoPago', label: 'Pago', options: metodosPago },
          { key: 'cliente', label: 'Cliente' },
        ]}
        rowActions={(row) => (
          <>
            <BotonAccion accion="verDetalle" icono={Eye} etiqueta="Ver detalle y productos" tono="acento" onClick={() => setDetalleDe(row)} />
            <BotonAccion accion="descargarPdf"
              icono={Receipt}
              etiqueta="Generar comprobante de venta"
              tono="exito"
              deshabilitado={row.estado !== 'Completada'}
              motivo="La venta todavía no está completada"
              onClick={() => setComprobanteDe(row)}
            />
            {/* A crédito, el pago se corrige desde los abonos (rechazar uno confirmado por error) */}
            <BotonAccion accion="registrarAbono"
              icono={Wallet}
              etiqueta="Gestionar el pago (abonos del crédito)"
              deshabilitado={!row.credito}
              motivo="Solo las ventas a crédito tienen abonos"
              onClick={() => setAbonosDe(row)}
            />
          </>
        )}
      />

      {detalleDe && (
        <DetalleCotizacionModal
          cotizacion={detalleDe}
          servicio={ventasService}
          onClose={() => setDetalleDe(null)}
        />
      )}
      {comprobanteDe && (
        <ComprobanteVentaModal
          venta={comprobanteDe}
          servicio={ventasService}
          onDescargarPdf={(v) => ventasService.descargarPdf(v.id)}
          onClose={() => setComprobanteDe(null)}
        />
      )}
      {abonosDe && (
        <HistorialAbonosModal
          credito={{ id: abonosDe.credito, cliente: abonosDe.cliente }}
          // Al cerrar se recarga: rechazar un abono cambia el total de la venta
          onClose={() => {
            setAbonosDe(null);
            ventas.recargar();
          }}
        />
      )}
    </div>
  );
}
