import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Disc3,
  HandCoins,
  Minus,
  Pencil,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import FormModal from '../../components/base/FormModal';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_OK, INPUT, LABEL, SECTION as SECTION_TEXT } from '../../components/base/formStyles';
import {
  CUOTA_INICIAL_CREDITO,
  INTERES_POR_PLAZO,
  metodosPago,
  PLAZOS_CREDITO,
  SERVICIO_POR_DEFECTO,
} from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useCredito } from '../../context/CreditoContext';
import { usePortal } from '../../context/PortalContext';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService, nuevaClaveIdempotencia } from '../../services';
import { formatCOP } from '../../utils/formato';
import { servicioInitialValues, servicioSectionsCliente } from '../shared/servicioSections';
import { CamposPago, pideComprobante } from '../shared/PagoConsignacion';
import CotizacionEnviadaModal from './CotizacionEnviadaModal';
import CuotaInicialModal from './CuotaInicialModal';

const SELECT = `${INPUT} ${BORDER_OK} cursor-pointer appearance-none pr-10`;

/**
 * Contenido de la cotización-pedido en curso (el "carrito").
 *
 * Es la columna derecha del catálogo cuando el cliente abre la cotización.
 * Ahora que los productos tienen precio de venta, el carrito ya muestra el
 * subtotal; si el cliente pacta crédito, el sistema aplica el interés del
 * plazo y calcula la cuota inicial del 50% que exige la empresa. El valor
 * definitivo lo confirma el asesor.
 *
 * Al enviar, el servicio de cotizaciones la guarda; la API vuelve a tomar
 * los precios del catálogo y a validar las reglas del crédito antes de
 * aceptarla.
 */
export default function PedidoPanel({ onClose = null }) {
  const navigate = useNavigate();
  const cart = useCart();
  const { saldoUsableTexto, alcanza, tieneCredito, credito } = useCredito();
  const { usuario } = useAuth();
  const { recargar } = usePortal();
  const { enviando, errorEnvio, enviar } = useEnvio();

  const [metodoPago, setMetodoPago] = useState('Contado');
  // Pago de contado: medio y consignación ({ medioPago, comprobante })
  const [pagoContado, setPagoContado] = useState({ medioPago: '', comprobante: '' });
  const [erroresPago, setErroresPago] = useState({});
  const [servicioModal, setServicioModal] = useState(false);
  // Servicio del detalle que se está editando (null = ninguno)
  const [servicioEditado, setServicioEditado] = useState(null);
  const [enviada, setEnviada] = useState(false);
  // Clave anti-duplicados de este envío: un doble clic o un reintento no
  // crea dos cotizaciones. Se renueva después de cada cotización enviada.
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClaveIdempotencia);
  const [plazo, setPlazo] = useState(30);
  const [errorCredito, setErrorCredito] = useState('');
  // Abono de la cuota inicial: sin él no se envía una cotización a crédito
  const [cuotaModal, setCuotaModal] = useState(false);
  const [abonoInicial, setAbonoInicial] = useState(null);

  const vacio = cart.count === 0;
  const esCredito = metodoPago === 'Crédito';

  // ---- Valores de la cotización ----------------------------------------
  const subtotal = cart.subtotal;
  // Mismo cálculo que hace la API, para que la vista previa coincida
  const interes = esCredito ? Math.round(subtotal * (INTERES_POR_PLAZO[plazo] ?? 0)) : 0;
  const total = subtotal + interes;
  const cuotaInicial = esCredito ? Math.round(total * CUOTA_INICIAL_CREDITO) : 0;
  const aFinanciar = total - cuotaInicial;
  const cuotas = plazo / 30;
  const cuotaAproximada = aFinanciar > 0 ? Math.round(aFinanciar / cuotas) : 0;
  const excedeSaldo = esCredito && total > 0 && !tieneCredito && !alcanza(total);

  /**
   * Guarda el servicio del formulario: uno nuevo, o los cambios de uno que
   * se está editando. No lleva precio: el asesor le pone valor después en
   * "Solicitudes de servicio" y el cliente lo paga aparte.
   */
  const guardarServicio = (values) => {
    const datos = {
      servicio: SERVICIO_POR_DEFECTO,
      cantidad: Number(values.cantidad) || 1,
      medidas: values.medidas ?? '',
      foto: values.foto,
      descripcion: values.descripcion,
      estadoEvidencia: 'Pendiente de revisión',
    };
    if (servicioEditado) cart.updateServicio(servicioEditado.id, datos);
    else cart.addServicio(datos);
  };

  const guardarCotizacion = () => {
    if (esCredito) {
      // La empresa financia un solo crédito por cliente a la vez
      if (tieneCredito) {
        setErrorCredito('Ya tienes un crédito abierto. Sáldalo para pedir otro o paga de contado.');
        return;
      }
      // Con crédito, el total no puede pasarse del cupo de cartera
      if (excedeSaldo) {
        setErrorCredito(`Tu saldo usable es ${saldoUsableTexto}. Reduce la cotización o paga de contado.`);
        return;
      }
      // Y la empresa exige el adelanto antes de montar el crédito
      if (!abonoInicial) {
        setErrorCredito('Registra el abono de la cuota inicial para enviar la cotización.');
        setCuotaModal(true);
        return;
      }
    }
    setErrorCredito('');

    // De contado (con productos que cobrar): cómo paga y su consignación
    const pagaContado = !esCredito && total > 0;
    if (pagaContado) {
      const faltan = {};
      if (!pagoContado.medioPago) faltan.medioPago = 'Elige cómo vas a pagar';
      else if (pideComprobante(pagoContado.medioPago) && !pagoContado.comprobante) {
        faltan.comprobante = 'Sube la consignación del pago';
      }
      setErroresPago(faltan);
      if (Object.keys(faltan).length > 0) return;
    }

    // La dirección de despacho es la del perfil del cliente
    if (!usuario.direccion) {
      setErrorCredito('Agrega tu dirección en "Mi perfil" para saber a dónde despachar el pedido.');
      return;
    }

    // El servicio arma lo que pide la API (los precios los pone el servidor)
    enviar(async () => {
      await cotizacionesService.crearDesdePortal({
        metodoPago,
        plazo,
        direccion: usuario.direccion,
        productos: cart.productos,
        servicios: cart.servicios,
        abonoInicial,
        pago: pagaContado ? pagoContado : null,
        claveIdempotencia,
      });
      setClaveIdempotencia(nuevaClaveIdempotencia());
      setPagoContado({ medioPago: '', comprobante: '' });
      await recargar();
      setEnviada(true);
    });
  };

  /** El abono queda registrado y la cotización se puede enviar. */
  const registrarCuotaInicial = (abono) => {
    setAbonoInicial(abono);
    setErrorCredito('');
  };

  /** Al cerrar el aviso, el carrito se limpia y se va al listado. */
  const cerrarAviso = () => {
    setEnviada(false);
    cart.clear();
    navigate('/portal/pedidos');
  };

  return (
    <div className="space-y-4">
      {/* ================= Líneas de la cotización ================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800">
        <div className="h-[3px] w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400/0" />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400">
              <ShoppingCart size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Detalle de la cotización</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cart.count} {cart.count === 1 ? 'línea' : 'líneas'} · {cart.unidades} llantas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServicioModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400 px-3 py-2 text-sm font-bold text-amber-600 hover:bg-amber-400/10 dark:text-amber-400"
            >
              <Wrench size={15} /> Agregar servicio
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100"
                aria-label="Cerrar la cotización"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>

        {vacio ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
              <Disc3 size={22} strokeWidth={1.5} />
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tu cotización está vacía</p>
            <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
              Agrega llantas desde el catálogo o registra un servicio de reencauche.
            </p>
            {!onClose && (
              <Link
                to="/portal/catalogo"
                className="mt-1 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"
              >
                Ir al catálogo
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {/* ---- Llantas ---- */}
            {cart.productos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-4">
                <TireThumb brand={p.marca} foto={p.foto} className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-amber-500 dark:text-amber-400">
                    {p.marca.toUpperCase()}
                  </p>
                  <p className="text-sm font-bold leading-snug text-slate-900 dark:text-white">{p.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCOP(p.precioVenta)} c/u
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() =>
                      // Con una sola unidad, el menos saca la línea del pedido
                      p.cantidad === 1 ? cart.removeProducto(p.id) : cart.setCantidad(p.id, p.cantidad - 1)
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label={p.cantidad === 1 ? 'Quitar del pedido' : 'Quitar una'}
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-7 text-center text-sm font-bold text-slate-800 dark:text-slate-100">
                    {p.cantidad}
                  </span>
                  <button
                    onClick={() => cart.setCantidad(p.id, p.cantidad + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Agregar una"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <button
                  onClick={() => cart.removeProducto(p.id)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                  aria-label="Eliminar de la cotización"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}

            {/* ---- Servicios de reencauche ---- */}
            {cart.servicios.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-5 py-4">
                {s.foto ? (
                  <img src={s.foto} alt="Carcasa" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/5">
                    <Wrench size={20} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-blue-500 dark:text-blue-400">SERVICIO</p>
                  <p className="text-sm font-bold leading-snug text-slate-900 dark:text-white">{s.servicio}</p>
                  <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{s.descripcion}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge>{s.estadoEvidencia}</Badge>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {s.cantidad} llantas · valor por definir
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => setServicioEditado(s)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-amber-500"
                    aria-label="Editar el servicio"
                    title="Editar el servicio"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => cart.removeServicio(s.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                    aria-label="Eliminar de la cotización"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================= Datos de la cotización ================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
        <p className={SECTION_TEXT}>Datos de la cotización</p>

        <div className="mt-4">
          <label htmlFor="pp-pago" className={LABEL}>
            Método de pago
          </label>
          <div className="relative">
            <select
              id="pp-pago"
              value={metodoPago}
              onChange={(e) => {
                setMetodoPago(e.target.value);
                setErrorCredito('');
              }}
              className={SELECT}
            >
              {metodosPago.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>

        {/* ---- Pago de contado: medio y consignación ---- */}
        {!esCredito && total > 0 && (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
            <CamposPago
              pago={pagoContado}
              errores={erroresPago}
              onCambio={(pago) => {
                setPagoContado(pago);
                // Validación en tiempo real: el aviso se va al corregir el dato
                setErroresPago((e) => ({
                  medioPago: pago.medioPago ? undefined : e.medioPago,
                  comprobante: !pideComprobante(pago.medioPago) || pago.comprobante ? undefined : e.comprobante,
                }));
              }}
            />
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Tu pedido sigue su proceso cuando un asesor confirme el pago.
            </p>
          </div>
        )}

        {/* ---- Condiciones del crédito ---- */}
        {esCredito && (
          <div className="mt-4 space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  tieneCredito ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                Saldo usable
              </span>
              <span
                className={`text-sm font-bold ${
                  tieneCredito ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {saldoUsableTexto}
              </span>
            </div>

            {/* Con un crédito abierto no se puede montar otro */}
            {tieneCredito && (
              <p className="rounded-lg border border-red-400/40 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
                Ya tienes el crédito {credito.id} abierto por {credito.montoTotal}. Sáldalo para pedir
                otro o paga esta cotización de contado.
              </p>
            )}

            <div>
              <span className={LABEL}>Plazo</span>
              <div className="grid grid-cols-3 gap-2">
                {PLAZOS_CREDITO.map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setPlazo(dias)}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${
                      plazo === dias
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'border-slate-200 text-slate-500 hover:bg-white dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                  >
                    {dias} días
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                A {plazo} días se suma un {(INTERES_POR_PLAZO[plazo] * 100).toFixed(0)}% sobre el valor de la
                cotización.
              </p>
            </div>

            <dl className="space-y-2 border-t border-emerald-500/20 pt-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Cuota inicial (50%)</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">{formatCOP(cuotaInicial)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">
                  Cuota aproximada · {cuotas} {cuotas === 1 ? 'cuota' : 'cuotas'}
                </dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">
                  {cuotaAproximada > 0 ? formatCOP(cuotaAproximada) : '—'}
                </dd>
              </div>
            </dl>

            {/* ---- Abono de la cuota inicial ---- */}
            {abonoInicial ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Check size={13} strokeWidth={3} /> Cuota inicial abonada
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {abonoInicial.monto} · {abonoInicial.metodoPago}
                </span>
                <button
                  type="button"
                  onClick={() => setCuotaModal(true)}
                  className="text-[11px] font-semibold text-emerald-700 underline dark:text-emerald-400"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={vacio || excedeSaldo || tieneCredito}
                onClick={() => setCuotaModal(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-400"
              >
                <HandCoins size={14} /> Abonar la cuota inicial
              </button>
            )}

            {excedeSaldo && (
              <p className="text-xs font-medium text-red-500">
                La cotización supera tu saldo usable de {saldoUsableTexto}.
              </p>
            )}
            {errorCredito && !excedeSaldo && <p className="text-xs font-medium text-red-500">{errorCredito}</p>}
          </div>
        )}
      </div>

      {/* ================= Resumen y envío ================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
        <p className={SECTION_TEXT}>Resumen</p>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">
              Productos y servicios · {cart.unidades} llantas
            </dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100">{formatCOP(subtotal)}</dd>
          </div>
          {esCredito && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">
                Interés ({(INTERES_POR_PLAZO[plazo] * 100).toFixed(0)}%)
              </dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100">{formatCOP(interes)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
            <dt className="font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Total</dt>
            <dd className="text-xl font-bold text-slate-900 dark:text-white">{formatCOP(total)}</dd>
          </div>
        </dl>

        <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400 dark:border-white/10 dark:text-slate-500">
          El total es el precio de los productos × su cantidad. Los servicios de reencauche se cobran aparte,
          cuando un asesor les asigne su valor.
        </p>

        <div className="mt-5 space-y-2">
          <AvisoError mensaje={errorEnvio || (!esCredito ? errorCredito : '')} />
          <button
            onClick={guardarCotizacion}
            disabled={vacio || enviando}
            className="ml-pulsable inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Save size={16} /> {enviando ? 'Enviando…' : 'Enviar cotización'}
          </button>
          <button
            onClick={() => (onClose ? onClose() : navigate('/portal/catalogo'))}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Cancelar
          </button>
        </div>
      </div>

      {(servicioModal || servicioEditado) && (
        <FormModal
          mode={servicioEditado ? 'edit' : 'create'}
          title={servicioEditado ? 'Editar servicio' : 'Agregar servicio'}
          subtitle="Reencauche: sube la foto de la carcasa para que el asesor evalúe si es apta. El valor lo define el asesor y se paga aparte."
          sections={servicioSectionsCliente}
          initialValues={servicioEditado ?? servicioInitialValues}
          submitLabel={servicioEditado ? 'Guardar cambios' : 'Agregar a la cotización'}
          onSubmit={guardarServicio}
          onClose={() => {
            setServicioModal(false);
            setServicioEditado(null);
          }}
        />
      )}

      {cuotaModal && (
        <CuotaInicialModal
          total={total}
          minimo={cuotaInicial}
          onSubmit={registrarCuotaInicial}
          onClose={() => setCuotaModal(false)}
        />
      )}

      {enviada && (
        <CotizacionEnviadaModal
          credito={
            esCredito
              ? {
                  valor: formatCOP(total),
                  plazo,
                  cuota: formatCOP(cuotaAproximada),
                  inicial: abonoInicial?.monto ?? formatCOP(cuotaInicial),
                }
              : null
          }
          onClose={cerrarAviso}
        />
      )}
    </div>
  );
}
