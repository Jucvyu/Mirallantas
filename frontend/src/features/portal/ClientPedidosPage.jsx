import { useMemo, useState } from 'react';
import {
  Ban,
  Eye,
  CalendarClock,
  CalendarDays,
  Check,
  FileDown,
  HandCoins,
  Hourglass,
  ChevronDown,
  CreditCard,
  FileText,
  MapPin,
  Package,
  Plus,
  Receipt,
  Wrench,
} from 'lucide-react';
import Badge from '../../components/base/Badge';
import CardList from '../../components/base/CardList';
import LiquidGlass from '../../components/base/LiquidGlass';
import Modal from '../../components/base/Modal';
import MotivoModal from '../../components/base/MotivoModal';
import {
  ESTADO_COTIZACION_COMPLETADA,
  estadosCotizacion,
  CREDITO_SIN_INICIAR,
  estadosEntrega,
  estadosServicio,
  ESTADOS_PAGO,
  ETAPAS_COTIZACION,
  metodosPago,
  PLAZO_RESPUESTA_HORAS,
  VIGENCIA_COTIZACION_DIAS,
} from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { usePortal } from '../../context/PortalContext';
import { cotizacionesService, creditosService, ventasService } from '../../services';
import AceptarCotizacionModal from '../shared/AceptarCotizacionModal';
import PagoCotizacion from './PagoCotizacion';
import PagoServicio from './PagoServicio';
import ReencaucheModal from './ReencaucheModal';
import RegistrarAbonoModal from './RegistrarAbonoModal';
import ComprobanteVentaModal from '../shared/ComprobanteVentaModal';
import { fechaISO } from '../../utils/formato';
import Tooltip from '../../components/base/Tooltip';

// -------------------------------------------------------------------------
// Aspecto de la carta según cómo va el crédito: contorno marcado y, solo en
// modo claro, un fondo del mismo tono muy tenue. En oscuro basta con el
// contorno. Las cotizaciones de contado quedan neutras.
// -------------------------------------------------------------------------
const ESTILO_CREDITO = {
  'Al día': 'border-emerald-400 bg-emerald-50 dark:border-emerald-400/70 dark:bg-brand-navy-800',
  Vencido: 'border-red-400 bg-red-50 dark:border-red-400/70 dark:bg-brand-navy-800',
  Pagado: 'border-slate-300 bg-slate-100/70 dark:border-white/25 dark:bg-brand-navy-800',
  [CREDITO_SIN_INICIAR]: 'border-amber-400 bg-amber-50 dark:border-amber-400/70 dark:bg-brand-navy-800',
};

const ESTILO_NEUTRO = 'border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800';

// Pago rechazado: la carta se marca en rojo hasta que el cliente vuelva a pagar
const ESTILO_PAGO_RECHAZADO = 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-brand-navy-800';

/** Pasos por los que avanza el despacho, en orden. */
const PASOS_ENTREGA = ['Pendiente', 'En camino', 'Entregado'];

// Valores de "sin dato" que se ofrecen en los filtros derivados.
const SIN_CREDITO = 'Sin crédito';
const SIN_REENCAUCHE = 'Sin reencauche';

/** "$ 575.000" → 575000 */
const aNumero = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0;

/**
 * Cómo va el crédito hoy. En el modelo `credito.estado` es un booleano, así
 * que la condición (al día, vencido o pagado) se deduce del saldo y de la
 * fecha límite.
 */
function condicionCredito(credito) {
  if (!credito) return null;
  if (!credito.iniciado) return CREDITO_SIN_INICIAR;
  if (aNumero(credito.saldoPendiente) === 0) return 'Pagado';
  return new Date(credito.fechaLimite) < new Date() ? 'Vencido' : 'Al día';
}

/** Fecha en el formato estándar AAAA-MM-DD */
const fechaCorta = (f) => fechaISO(f);

/** Cómo se le nombra cada etapa al cliente. */
const ETIQUETA_ETAPA = {
  Solicitud: 'Precios por confirmar',
  Emitida: 'Cotización formal',
  Vencida: 'Vencida',
  Aceptada: 'Aceptada',
};

/** Guion para un estado que no aplica a la cotización. */
function SinDato() {
  return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
}

export default function ClientPedidosPage() {
  const { usuario } = useAuth();
  const nombre = usuario.nombre;
  const { abonos, cotizaciones: cotizacionesCliente, creditos, recargar } = usePortal();

  /** Abono al crédito. Queda pendiente hasta que un asesor lo valide. */
  const registrarAbono = async (datos) => {
    await creditosService.registrarAbono(datos);
    await recargar();
  };

  // Detalles abiertos: el de cada cotización se ve en un modal aparte; los
  // servicios, dentro de él, se despliegan uno a uno. Son objetos (y no un id)
  // para que cada uno se abra y cierre por separado.
  const [cotizacionesAbiertas, setCotizacionesAbiertas] = useState({});
  const [serviciosAbiertos, setServiciosAbiertos] = useState({});
  const [reencaucheDe, setReencaucheDe] = useState(null);
  const [abonoDe, setAbonoDe] = useState(null);
  const [reciboDe, setReciboDe] = useState(null);
  const [aceptando, setAceptando] = useState(null);
  // Cotización que el cliente va a cancelar (se pide el motivo)
  const [cancelando, setCancelando] = useState(null);
  const [errorPdf, setErrorPdf] = useState('');

  const descargarPdf = (c) => {
    setErrorPdf('');
    cotizacionesService.descargarPdf(c.id).catch((e) => setErrorPdf(e.message));
  };

  const alternarCotizacion = (id) => setCotizacionesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));
  const alternarServicio = (clave) => setServiciosAbiertos((prev) => ({ ...prev, [clave]: !prev[clave] }));

  // -----------------------------------------------------------------------
  // A cada cotización se le adjuntan su crédito y las solicitudes de
  // servicio de sus líneas, y se arma un texto `buscable` para que el
  // buscador encuentre también por número de crédito o de solicitud.
  // -----------------------------------------------------------------------
  const cotizaciones = useMemo(
    () =>
      cotizacionesCliente.map((cot) => {
        const credito = creditos.find((c) => c.cotizacion === cot.id) ?? null;
        const solicitudes = cot.detalle
          .filter((l) => l.tipo === 'servicio' && l.solicitudDatos)
          .map((l) => l.solicitudDatos);

        return {
          ...cot,
          credito,
          condicion: condicionCredito(credito),
          solicitudes,
          buscable: [cot.id, cot.total, cot.fecha, credito?.id, ...solicitudes.map((s) => s.id)]
            .filter(Boolean)
            .join(' '),
        };
      }),
    [cotizacionesCliente, creditos],
  );

  // -----------------------------------------------------------------------
  // Filtros derivados: el dato no está plano en la cotización, así que cada
  // uno trae su propia función de coincidencia.
  // -----------------------------------------------------------------------
  const filtros = [
    { key: 'etapa', label: 'Etapa', options: ETAPAS_COTIZACION },
    { key: 'estado', label: 'Cotización', options: estadosCotizacion },
    { key: 'estadoEntrega', label: 'Entrega', options: estadosEntrega },
    { key: 'metodoPago', label: 'Método de pago', options: metodosPago },
    { key: 'estadoPago', label: 'Estado de pago', options: ESTADOS_PAGO },
    {
      key: 'filtroCredito',
      label: 'Crédito',
      options: ['Al día', 'Vencido', 'Pagado', CREDITO_SIN_INICIAR, SIN_CREDITO],
      match: (c, valor) => (valor === SIN_CREDITO ? !c.credito : c.condicion === valor),
    },
    {
      key: 'filtroReencauche',
      label: 'Reencauche',
      options: [...estadosServicio, SIN_REENCAUCHE],
      match: (c, valor) =>
        valor === SIN_REENCAUCHE
          ? c.solicitudes.length === 0
          : c.solicitudes.some((s) => s.estado === valor),
    },
  ];

  // Las cotizaciones a crédito encabezan; dentro de cada grupo manda la fecha.
  const porGrupoYFecha = (direccion) => (a, b) => {
    const grupo = Number(Boolean(b.credito)) - Number(Boolean(a.credito));
    if (grupo !== 0) return grupo;
    return direccion * a.fecha.localeCompare(b.fecha);
  };

  const ordenes = [
    // Por defecto, el orden de la API: primero la que el asesor cambió por última vez
    { value: 'actualizadas', label: 'Últimas actualizadas', compare: () => 0 },
    { value: 'fecha-desc', label: 'Fecha: más recientes', compare: porGrupoYFecha(-1) },
    { value: 'fecha-asc', label: 'Fecha: más antiguas', compare: porGrupoYFecha(1) },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
        Mis Cotizaciones-Pedido
      </h1>
      <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
        Historial completo de tus solicitudes · las de crédito aparecen primero
      </p>

      <CardList
        items={cotizaciones}
        searchKeys={['buscable']}
        filters={filtros}
        sortOptions={ordenes}
        stickyToolbar
        emptyIcon="FileText"
        emptyTitle="Sin cotizaciones"
        emptyDescription="Aquí verás las cotizaciones-pedido que envíes."
        renderCard={(c) => {
          const abierto = Boolean(cotizacionesAbiertas[c.id]);
          const estilo =
            c.estadoPago === 'Rechazado'
              ? ESTILO_PAGO_RECHAZADO
              : (c.condicion && ESTILO_CREDITO[c.condicion]) || ESTILO_NEUTRO;
          const abonosDelCredito = c.credito ? abonos.filter((a) => a.credito === c.credito.id) : [];
          const pasoActual = PASOS_ENTREGA.indexOf(c.estadoEntrega);
          const cancelada = c.estadoEntrega === 'Cancelado';

          return (
            // Variante neutra: conserva los colores de estado de la carta y suma
            // solo la interacción del vidrio (inclinación y reflejo)
            <LiquidGlass
              key={c.id}
              as="article"
              variante="neutra"
              inclinacion={3}
              className={`flex flex-col rounded-xl border-2 p-5 ${estilo}`}
            >
              {/* ---- Estados. Todas las cartas llevan las mismas filas (con
                   "—" si no aplica) para que queden del mismo alto ---- */}
              <div className="flex flex-col gap-1.5">
                <div className="flex h-6 items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Etapa
                  </span>
                  <Badge tone={c.etapa}>{ETIQUETA_ETAPA[c.etapa] ?? c.etapa}</Badge>
                </div>
                <div className="flex h-6 items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Crédito
                  </span>
                  {c.credito ? <Badge>{c.condicion}</Badge> : <SinDato />}
                </div>
                <div className="flex h-6 items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Pago
                  </span>
                  {c.estadoPago ? <Badge>{c.estadoPago}</Badge> : <SinDato />}
                </div>
                <div className="flex h-6 items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Cotización
                  </span>
                  <Badge>{c.estado}</Badge>
                </div>
                <div className="flex h-6 items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Entrega
                  </span>
                  <Badge>{c.estadoEntrega}</Badge>
                </div>
              </div>

              {/* ---- Resumen ---- */}
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{c.id}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <CalendarDays size={12} /> {c.fecha}
                </p>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Package size={13} /> {c.items} {c.items === 1 ? 'llanta' : 'llantas'}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <CreditCard size={13} /> {c.metodoPago || 'Se elige al aceptar la cotización'}
              </p>
              {/* Una sola línea (la dirección completa queda en el título) */}
              <p
                title={c.direccionEntrega}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              >
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{c.direccionEntrega || 'Sin dirección'}</span>
              </p>

              <div className="mt-4 flex items-end justify-between border-t border-slate-200/70 pt-4 dark:border-white/5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Total
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold text-slate-900 dark:text-white">
                    {c.etapa === 'Solicitud' ? 'Por confirmar' : c.total}
                  </span>
                  {/* Siempre la misma altura: el desglose o un espacio vacío */}
                  <span className="block h-4 text-[10px] text-slate-500 dark:text-slate-400">
                    {c.conServicios ? `Incluye servicios por ${c.totalServicios}` : ''}
                  </span>
                </span>
              </div>

              {/* ---- Vigencia y acciones según la etapa (mismo alto en todas) ---- */}
              <div className="mt-3 flex min-h-[4.25rem] flex-col justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                {c.etapa === 'Solicitud' && (
                  <p className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                    <Hourglass size={13} className="mt-px shrink-0" />
                    Estamos confirmando los precios con nuestros proveedores (respuesta en hasta {PLAZO_RESPUESTA_HORAS}{' '}
                    horas). Todavía no es una cotización formal.
                  </p>
                )}
                {c.etapa === 'Emitida' && (
                  <>
                    <p className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                      <CalendarClock size={13} className="shrink-0 text-amber-500" />
                      Válida hasta el {fechaCorta(c.venceEn)} ({VIGENCIA_COTIZACION_DIAS} días)
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAceptando(c)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-amber-400 py-1.5 text-[11px] font-bold text-slate-900 hover:bg-amber-300"
                      >
                        <HandCoins size={12} /> Aceptar cotización
                      </button>
                      <Tooltip texto="Descargar la cotización en PDF">
                        <button
                          type="button"
                          onClick={() => descargarPdf(c)}
                          className="flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white dark:border-white/10 dark:text-slate-300"
                        >
                          <FileDown size={12} /> PDF
                        </button>
                      </Tooltip>
                    </div>
                  </>
                )}
                {c.etapa === 'Vencida' && (
                  <p className="font-medium text-red-600 dark:text-red-400">
                    Venció el {fechaCorta(c.venceEn)}. Escríbenos para actualizar los precios.
                  </p>
                )}
                {c.etapa === 'Aceptada' &&
                  (c.emitidaEn ? (
                    <button
                      type="button"
                      onClick={() => descargarPdf(c)}
                      className="flex items-center gap-1 self-start font-semibold text-slate-600 hover:text-amber-600 dark:text-slate-300"
                    >
                      <FileDown size={13} /> Descargar la cotización (PDF)
                    </button>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">Reencauche: su valor se gestiona en el servicio.</p>
                  ))}
                {/* Mientras no la acepte, el cliente puede cancelarla (no se borra) */}
                {c.estado === 'Pendiente' && c.etapa !== 'Aceptada' && (
                  <button
                    type="button"
                    onClick={() => setCancelando(c)}
                    className="flex items-center gap-1 self-start text-[11px] font-semibold text-red-500 hover:text-red-600"
                  >
                    <Ban size={12} /> Cancelar cotización
                  </button>
                )}
              </div>

              {/* ---- Crédito aprobado: pagar la cuota sin abrir el detalle ---- */}
              {c.metodoPago === 'Crédito' && c.credito && !c.pagoEstado && (
                <PagoCotizacion cotizacion={c} onPagado={recargar} />
              )}

              {/* ---- El detalle completo se abre en un modal aparte ---- */}
              <button
                type="button"
                onClick={() => alternarCotizacion(c.id)}
                aria-haspopup="dialog"
                title="Ver productos, servicios, pagos, entrega y crédito de esta cotización"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/60 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-white dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
              >
                <Eye size={14} /> Ver detalle completo
              </button>

              {abierto && (
                <Modal
                  title={`Cotización ${c.id}`}
                  subtitle={`${c.estado} · ${c.etapa}`}
                  icon={<FileText size={17} />}
                  size="lg"
                  onClose={() => alternarCotizacion(c.id)}
                  footer={(cerrar) => (
                    <button
                      type="button"
                      onClick={cerrar}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
                    >
                      Cerrar
                    </button>
                  )}
                >
                <div>
                  {/* ---- Fechas y vigencia ---- */}
                  <dl className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['Solicitada', c.fecha],
                      ['Emitida', c.emitidaEn ? fechaCorta(c.emitidaEn) : 'Pendiente'],
                      ['Vence', c.venceEn ? fechaCorta(c.venceEn) : '—'],
                      [
                        'Vigencia',
                        c.etapa === 'Solicitud'
                          ? `Empieza al emitirla (${VIGENCIA_COTIZACION_DIAS} días)`
                          : c.emitidaEn
                            ? `${VIGENCIA_COTIZACION_DIAS} días calendario`
                            : 'No aplica',
                      ],
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="rounded-lg bg-white/60 px-2.5 py-2 dark:bg-white/5">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
                        <dd className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">{valor}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    Productos y servicios
                  </p>

                  <ul className="mt-2 divide-y divide-slate-200/70 rounded-lg border border-slate-200 bg-white/60 dark:divide-white/5 dark:border-white/10 dark:bg-transparent">
                    {c.detalle.map((linea, i) => {
                      const claveServicio = `${c.id}-${i}`;
                      const servicioAbierto = Boolean(serviciosAbiertos[claveServicio]);
                      const esServicio = linea.tipo === 'servicio';
                      // La API manda con cada servicio el estado de su reencauche
                      const solicitud = esServicio ? linea.solicitudDatos : null;
                      // Pago rechazado: el servicio se marca en rojo hasta que se vuelva a subir
                      const pagoRechazado = solicitud?.pagoEstado === 'Rechazado';
                      const pagado = solicitud?.pagoEstado === 'Aprobado';
                      // Cancelado (por ejemplo, la carcasa no fue apta): ya no se paga ni avanza
                      const servicioCancelado = solicitud?.estado === 'Cancelado';
                      // Su precio va dentro del total de la cotización: se paga con ella
                      const incluido = esServicio && linea.precioUnitarioValor > 0;

                      return (
                        <li
                          key={claveServicio}
                          className={`px-3 py-2.5 ${pagoRechazado ? 'bg-red-500/5 ring-1 ring-inset ring-red-400/60' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                esServicio
                                  ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                                  : 'bg-amber-400/15 text-amber-500 dark:text-amber-400'
                              }`}
                            >
                              {esServicio ? <Wrench size={13} /> : <Package size={13} />}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                                {linea.nombre}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {solicitud
                                  ? `${linea.medida} · ${linea.cantidad} llantas · ${incluido ? 'incluido en el total' : 'se paga aparte'}`
                                  : `${linea.medida} · ${linea.cantidad} × ${linea.unitario}`}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 text-xs font-bold ${
                                pagoRechazado ? 'text-red-500' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {solicitud
                                ? solicitud.precioTexto
                                : linea.precioUnitarioValor === null
                                  ? 'Por confirmar'
                                  : linea.subtotal}
                            </span>
                          </div>

                          {/* ---- Solicitud de reencauche, desplegable aparte ---- */}
                          {solicitud && (
                            <>
                              <button
                                type="button"
                                onClick={() => alternarServicio(claveServicio)}
                                aria-expanded={servicioAbierto}
                                className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border py-1.5 text-[11px] font-semibold transition-colors ${
                                  pagoRechazado
                                    ? 'border-red-400/60 text-red-600 hover:bg-red-500/10 dark:text-red-400'
                                    : 'border-blue-500/30 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400'
                                }`}
                              >
                                {servicioAbierto
                                  ? 'Ocultar servicio'
                                  : servicioCancelado
                                    ? 'Reencauche cancelado · ver detalle'
                                    : pagoRechazado
                                    ? 'Pago rechazado · ver detalle'
                                    : 'Ver detalle del servicio'}
                                <ChevronDown
                                  size={12}
                                  className={`transition-transform duration-200 ${
                                    servicioAbierto ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              <div
                                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                                  servicioAbierto ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                }`}
                              >
                                <div className="overflow-hidden">
                                  {/* Cancelado: el motivo. Incluido: se paga con la cotización. Si no, se cobra aparte */}
                                  {servicioCancelado ? (
                                    <div className="rounded-md border border-red-400/40 bg-red-500/5 px-3 py-2 text-[11px] dark:bg-red-500/10">
                                      <p className="font-bold text-red-600 dark:text-red-400">Reencauche cancelado</p>
                                      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                                        <span className="font-semibold">Motivo:</span>{' '}
                                        {solicitud.motivoCancelacion || 'Comunícate con tu asesor para más información.'}
                                      </p>
                                    </div>
                                  ) : incluido ? (
                                    <p
                                      className={`rounded-md px-3 py-2 text-[11px] font-semibold ${
                                        pagado
                                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
                                      }`}
                                    >
                                      {pagado ? 'Pagado con el total de la cotización.' : 'Se paga junto con el total de la cotización.'}
                                    </p>
                                  ) : (
                                    <PagoServicio servicio={solicitud} onPagado={recargar} />
                                  )}

                                  <dl className="mt-2 space-y-1.5 rounded-md bg-slate-100/80 p-3 text-[11px] dark:bg-white/5">
                                    {[
                                      ['Solicitud', solicitud.id],
                                      ['Modalidad', solicitud.servicio],
                                      ['Recepción', solicitud.fecha],
                                      // Revisión de la carcasa y, ya revisada, si lleva garantía
                                      ['Revisión de la carcasa', solicitud.estadoEvidencia],
                                      ...(solicitud.estadoEvidencia === 'Apta' ? [['Garantía', solicitud.garantia]] : []),
                                      ...(solicitud.observacionRevision ? [['Observación', solicitud.observacionRevision]] : []),
                                      // El seguimiento del reencauche aparece con el pago aprobado
                                      ...(pagado
                                        ? [
                                            ['Estado', solicitud.estado],
                                            ['Tiempo estimado', solicitud.tiempoEstimado || 'Por definir'],
                                          ]
                                        : []),
                                    ].map(([etiqueta, valor]) => (
                                      <div key={etiqueta} className="flex justify-between gap-3">
                                        <dt className="text-slate-500 dark:text-slate-400">{etiqueta}</dt>
                                        <dd className="text-right font-semibold text-slate-800 dark:text-slate-100">
                                          {valor}
                                        </dd>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between gap-3 pt-0.5">
                                      <dt className="text-slate-500 dark:text-slate-400">Carcasa</dt>
                                      <dd>
                                        <Badge>{solicitud.estadoEvidencia}</Badge>
                                      </dd>
                                    </div>
                                    <p className="border-t border-slate-200 pt-2 text-slate-500 dark:border-white/10 dark:text-slate-400">
                                      {solicitud.descripcion}
                                    </p>
                                  </dl>

                                  {pagado && !servicioCancelado && (
                                    <button
                                      type="button"
                                      onClick={() => setReencaucheDe(solicitud)}
                                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-500 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-blue-600"
                                    >
                                      <Wrench size={12} /> Ver estado del reencauche
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* ---- Pago de contado: estado, reintento e historial ---- */}
                  <PagoCotizacion cotizacion={c} onPagado={recargar} />

                  {/* ---- Seguimiento de la entrega ---- */}
                  <div className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Entrega
                    </p>
                    {cancelada ? (
                      <p className="mt-2 rounded-md border border-red-400/40 bg-red-500/5 px-3 py-2 text-[11px] font-medium text-red-600 dark:text-red-400">
                        Entrega cancelada
                        {c.motivoCancelacion ? ` · ${c.motivoCancelacion}` : ''}
                      </p>
                    ) : (
                      <ol className="mt-2 space-y-2">
                        {PASOS_ENTREGA.map((paso, i) => {
                          const hecho = i <= pasoActual;
                          return (
                            <li key={paso} className="flex items-center gap-2.5">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  hecho
                                    ? 'bg-emerald-500 text-white'
                                    : 'border border-slate-300 text-slate-400 dark:border-white/20'
                                }`}
                              >
                                {hecho ? <Check size={11} strokeWidth={3} /> : i + 1}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  hecho
                                    ? 'text-slate-800 dark:text-slate-100'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {paso}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>

                  {/* ---- Crédito y abonos de la cotización ---- */}
                  {c.credito && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Crédito {c.credito.id}
                        </p>
                        {/* Un crédito pagado al 100 % ya no recibe abonos */}
                        {c.condicion === 'Pagado' ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Crédito pagado
                          </span>
                        ) : !c.credito.iniciado ? (
                          // La cartera empieza con la cuota inicial pagada
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{CREDITO_SIN_INICIAR}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAbonoDe(c.credito)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-400 px-2 py-1 text-[11px] font-bold text-amber-600 transition-colors hover:bg-amber-400/10 dark:text-amber-400"
                          >
                            <Plus size={12} /> Registrar abono
                          </button>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[
                          ['MONTO', c.credito.montoTotal],
                          ['SALDO', c.credito.saldoPendiente],
                          ['PLAZO', `${c.credito.plazoDias} días`],
                          ['VENCE', c.credito.iniciado ? c.credito.fechaLimite : 'Al pagar la cuota'],
                        ].map(([etiqueta, valor]) => (
                          <div key={etiqueta} className="rounded-md bg-slate-100/80 p-2 dark:bg-white/5">
                            <p className="text-[10px] font-bold tracking-wide text-slate-400 dark:text-slate-500">
                              {etiqueta}
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">{valor}</p>
                          </div>
                        ))}
                      </div>

                      {abonosDelCredito.length > 0 && (
                        <ul className="mt-2 divide-y divide-slate-200/70 rounded-md border border-slate-200 bg-white/60 dark:divide-white/5 dark:border-white/10 dark:bg-transparent">
                          {abonosDelCredito.map((a) => (
                            <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                              <Receipt size={12} className="shrink-0 text-slate-400" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">
                                  {a.id} · {a.monto}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {a.fecha} · {a.metodoPago}
                                </p>
                              </div>
                              <Badge>{a.estado}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* ---- Comprobante: solo con la cotización completada ---- */}
                  {c.estado === ESTADO_COTIZACION_COMPLETADA && (
                    <button
                      type="button"
                      onClick={() => setReciboDe(c)}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400 py-2 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-400/10 dark:text-amber-400"
                    >
                      <FileText size={14} /> Ver recibo
                    </button>
                  )}
                </div>
                </Modal>
              )}
            </LiquidGlass>
          );
        }}
      />

      {/* Comprobante de venta generado con los datos de la cotización */}
      {errorPdf && (
        <p role="alert" className="mt-3 rounded-lg border border-red-400/50 bg-red-500/5 px-3 py-2 text-sm text-red-600">
          {errorPdf}
        </p>
      )}

      {/* Aceptar la cotización formal: contado o crédito (inicial del 30 %) */}
      {aceptando && (
        <AceptarCotizacionModal cotizacion={aceptando} desdePortal onAceptada={recargar} onClose={() => setAceptando(null)} />
      )}
      {cancelando && (
        <MotivoModal
          title="Cancelar la cotización"
          message="Queda cancelada y le avisamos al asesor. Esta acción no se puede deshacer."
          record={{ title: cancelando.id, subtitle: cancelando.etapa === 'Solicitud' ? 'Precios por confirmar' : cancelando.total }}
          label="¿Por qué la cancelas?"
          confirmLabel="Cancelar cotización"
          onConfirm={async (motivo) => {
            await cotizacionesService.cancelarDesdePortal(cancelando.id, motivo);
            await recargar();
          }}
          onClose={() => setCancelando(null)}
        />
      )}

      {reciboDe && (
        <ComprobanteVentaModal
          venta={{ ...reciboDe, cliente: nombre }}
          titulo="Recibo de compra"
          onDescargarPdf={reciboDe.venta ? () => ventasService.descargarPdf(reciboDe.venta, { desdePortal: true }) : undefined}
          onClose={() => setReciboDe(null)}
        />
      )}

      {/* Avance de la solicitud de reencauche */}
      {reencaucheDe && <ReencaucheModal solicitud={reencaucheDe} onClose={() => setReencaucheDe(null)} />}

      {/* Registro de un abono sobre el crédito de la cotización */}
      {abonoDe && (
        <RegistrarAbonoModal creditoId={abonoDe.id} onSubmit={registrarAbono} onClose={() => setAbonoDe(null)} />
      )}
    </div>
  );
}
