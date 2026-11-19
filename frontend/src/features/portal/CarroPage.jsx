import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Disc3, FilePlus2, Minus, Plus, ShoppingCart, Store, Trash2, Truck } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import AvisoError from '../../components/base/AvisoError';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, soloDigitos } from '../../components/base/formStyles';
import { WHATSAPP_EMPRESA } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { CANTIDAD_MAXIMA, useCart } from '../../context/CartContext';
import { usePortal } from '../../context/PortalContext';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService, nuevaClaveIdempotencia } from '../../services';
import { hoyISO } from '../../utils/formato';
import { errorTelefono } from '../../utils/validaciones';
import { enlaceWhatsApp, mensajeCotizacion } from '../../utils/whatsapp';
import CotizacionEnviadaModal from './CotizacionEnviadaModal';

const DESPACHO = 'Despacho';
const RECOGE = 'Recoge';

/** Máximo de caracteres de las observaciones (la API admite 300). */
const MAX_OBSERVACIONES = 300;

/** Fecha más lejana que se puede pedir: 6 meses (la API también lo limita). */
function enSeisMeses() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Datos de la variante que se muestran en cada línea del carro. */
function datosDe(p) {
  return [
    p.medidas && { etiqueta: 'Medida', valor: p.medidas },
    p.posicion && { etiqueta: 'Posición', valor: p.posicion },
    p.indiceCarga && { etiqueta: 'Índice de carga', valor: p.indiceCarga },
    p.tipoVehiculo && { etiqueta: 'Vehículo', valor: p.tipoVehiculo },
    p.codigo && { etiqueta: 'Código', valor: p.codigo },
  ].filter(Boolean);
}

/** Opción grande de "Despacho" / "Recojo en el local". */
function OpcionEntrega({ activa, icono: Icono, titulo, detalle, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={`flex flex-1 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
        activa
          ? 'border-amber-400 bg-amber-400/10'
          : 'border-slate-200 hover:border-amber-400/60 dark:border-white/10'
      }`}
    >
      <Icono size={18} className={`mt-0.5 shrink-0 ${activa ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} aria-hidden="true" />
      <span>
        <span className="block text-sm font-bold text-slate-900 dark:text-white">{titulo}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{detalle}</span>
      </span>
    </button>
  );
}

/**
 * Carro de cotización del cliente (/portal/carro), en su propia página.
 *
 * A la izquierda, las llantas elegidas con su detalle (medida, posición,
 * índice de carga, vehículo y código), su cantidad (que se puede cambiar) y
 * el botón para quitarlas. A la derecha, los datos de la solicitud:
 *   · Entrega: despacho a una dirección (por defecto la del perfil) o
 *     recoger en el local (entonces no se pide dirección).
 *   · Teléfono de contacto (por defecto el del perfil).
 *   · Para cuándo necesita las llantas (opcional).
 *   · Observaciones para el asesor (opcional).
 * No muestra precios ni stock: un asesor confirma los precios con el
 * proveedor y emite la cotización formal.
 *
 * "Crear solicitud de cotización" la registra en el sistema (con una clave
 * anti-duplicados: un doble clic no crea dos). "Solicitar por WhatsApp" abre
 * WhatsApp con el mensaje escrito; el envío lo hace el cliente desde allí.
 */
export default function CarroPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const { usuario } = useAuth();
  const { recargar } = usePortal();
  const { enviando, errorEnvio, enviar } = useEnvio();

  const [enviada, setEnviada] = useState(null);
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClaveIdempotencia);
  const [whatsappAbierto, setWhatsappAbierto] = useState(false);
  const [intento, setIntento] = useState(false);
  const [tocados, setTocados] = useState(() => new Set());
  const [datos, setDatos] = useState(() => ({
    modoEntrega: DESPACHO,
    direccion: usuario.direccion ?? '',
    telefono: usuario.telefono ?? '',
    fechaRequerida: '',
    observaciones: '',
  }));

  const vacio = cart.count === 0;
  const despacho = datos.modoEntrega === DESPACHO;
  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const tocar = (campo) => setTocados((t) => new Set(t).add(campo));

  // ---- Validación ---------------------------------------------------------
  const direccion = datos.direccion.trim();
  const telefono = datos.telefono.trim();
  const errores = {
    direccion: despacho && !direccion ? 'Escribe a dónde te despachamos el pedido' : direccion.length > 80 ? 'Máximo 80 caracteres' : '',
    telefono: telefono && errorTelefono(telefono),
    fechaRequerida:
      datos.fechaRequerida && datos.fechaRequerida < hoyISO()
        ? 'La fecha no puede ser anterior a hoy'
        : datos.fechaRequerida > enSeisMeses()
          ? 'Elige una fecha dentro de los próximos 6 meses'
          : '',
    observaciones: datos.observaciones.length > MAX_OBSERVACIONES ? `Máximo ${MAX_OBSERVACIONES} caracteres` : '',
  };
  const errorDe = (campo) => (intento || tocados.has(campo)) && errores[campo];
  const hayErrores = Object.values(errores).some(Boolean);

  const crearSolicitud = () => {
    setIntento(true);
    if (hayErrores) return;
    enviar(async () => {
      const { datos: solicitud } = await cotizacionesService.crearDesdePortal({
        modoEntrega: datos.modoEntrega,
        direccion: despacho ? direccion : null,
        telefono: telefono || null,
        fechaRequerida: datos.fechaRequerida || null,
        observaciones: datos.observaciones.trim() || null,
        productos: cart.productos,
        claveIdempotencia,
      });
      setClaveIdempotencia(nuevaClaveIdempotencia());
      await recargar();
      // Solo llantas reencauchadas: la cotización ya sale con su precio fijo
      setEnviada({ numero: solicitud.numero, emitida: Boolean(solicitud.emitidaEn) });
    });
  };

  /** Abre WhatsApp con el mensaje ya escrito (el cliente lo envía desde allí). */
  const solicitarPorWhatsApp = () => {
    setIntento(true);
    if (hayErrores) return;
    const texto = mensajeCotizacion({
      nombre: usuario.nombre,
      lugar: despacho ? direccion : 'Recojo en el local',
      productos: cart.productos,
      servicios: [],
    });
    window.open(enlaceWhatsApp(WHATSAPP_EMPRESA, texto), '_blank', 'noopener,noreferrer');
    setWhatsappAbierto(true);
  };

  /** Al cerrar el aviso, el carro se limpia y se va a "Mis cotizaciones". */
  const cerrarAviso = () => {
    setEnviada(null);
    cart.clear();
    navigate('/portal/pedidos');
  };

  return (
    <div>
      <Link
        to="/portal/catalogo"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Seguir en el catálogo
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
          <ShoppingCart size={26} className="text-amber-500" aria-hidden="true" /> Mi carro de cotización
        </h1>
        {!vacio && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {cart.count} {cart.count === 1 ? 'producto' : 'productos'} · {cart.unidades} {cart.unidades === 1 ? 'llanta' : 'llantas'}
          </p>
        )}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Revisa lo que vas a pedir y completa los datos. Un asesor confirma los precios con el proveedor y te envía la cotización formal.
      </p>

      {vacio ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-white/15">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
            <Disc3 size={26} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Tu carro está vacío</p>
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">Elige tus llantas en el catálogo y agrégalas aquí.</p>
          <Link to="/portal/catalogo" className="mt-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          {/* ================= Llantas ================= */}
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-brand-navy-800">
            {cart.productos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start gap-4 p-4 sm:flex-nowrap sm:p-5">
                <TireThumb brand={p.marca} foto={p.foto} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-amber-600 dark:text-amber-400">
                    {p.reencauchada ? 'LLANTA REENCAUCHADA' : p.marca.toUpperCase()}
                  </p>
                  <p className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                    {p.reencauchada ? p.descripcion || p.nombre : p.nombre}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-3">
                    {datosDe(p).map((d) => (
                      <div key={d.etiqueta} className="min-w-0">
                        <dt className="text-slate-400 dark:text-slate-500">{d.etiqueta}</dt>
                        <dd className="truncate font-semibold tabular-nums text-slate-700 dark:text-slate-200">{d.valor}</dd>
                      </div>
                    ))}
                  </dl>
                  {p.reencauchada && p.precioFijo > 0 && (
                    <p className="mt-2 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      $ {Number(p.precioFijo).toLocaleString('es-CO')} <span className="text-xs font-normal text-slate-500">· precio fijo</span>
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 self-center">
                  {p.reencauchada ? (
                    <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-300">
                      1 und. · única
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => cart.setCantidad(p.id, p.cantidad - 1)}
                        disabled={p.cantidad <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        aria-label={`Una llanta menos de ${p.nombre} ${p.medidas}`}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        inputMode="numeric"
                        value={p.cantidad}
                        onChange={(e) => cart.setCantidad(p.id, soloDigitos(e.target.value))}
                        aria-label={`Cantidad de ${p.nombre} ${p.medidas}`}
                        className={`${INPUT} ${BORDER_OK} !h-9 !w-14 !px-1 !py-1 text-center tabular-nums`}
                      />
                      <button
                        type="button"
                        onClick={() => cart.setCantidad(p.id, p.cantidad + 1)}
                        disabled={p.cantidad >= CANTIDAD_MAXIMA}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        aria-label={`Una llanta más de ${p.nombre} ${p.medidas}`}
                      >
                        <Plus size={14} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => cart.removeProducto(p.id)}
                    className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                    aria-label={`Quitar ${p.nombre} ${p.medidas} del carro`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* ================= Datos de la solicitud ================= */}
          <section
            aria-labelledby="datos-solicitud"
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800 lg:sticky lg:top-24"
          >
            <h2 id="datos-solicitud" className="text-base font-bold text-slate-900 dark:text-white">
              Datos de la solicitud
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <span className={LABEL} id="modo-entrega">
                  ¿Cómo lo recibes?
                </span>
                <div role="radiogroup" aria-labelledby="modo-entrega" className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                  <OpcionEntrega
                    activa={despacho}
                    icono={Truck}
                    titulo="Despacho"
                    detalle="Te lo llevamos"
                    onClick={() => cambiar('modoEntrega', DESPACHO)}
                  />
                  <OpcionEntrega
                    activa={!despacho}
                    icono={Store}
                    titulo="Recojo en el local"
                    detalle="Pasas por él"
                    onClick={() => cambiar('modoEntrega', RECOGE)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="carro-direccion" className={`${LABEL} ${despacho ? '' : 'opacity-60'}`}>
                  Dirección de despacho {despacho && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="carro-direccion"
                  maxLength={80}
                  disabled={!despacho}
                  value={despacho ? datos.direccion : ''}
                  onChange={(e) => cambiar('direccion', e.target.value)}
                  onBlur={() => tocar('direccion')}
                  placeholder={despacho ? 'Calle 50 #45-12, Medellín' : 'No aplica: recoges en el local'}
                  aria-invalid={Boolean(errorDe('direccion'))}
                  className={`${INPUT} ${errorDe('direccion') ? BORDER_ERR : BORDER_OK} ${despacho ? '' : 'cursor-not-allowed opacity-50'}`}
                />
                <p className={`mt-1 text-xs ${errorDe('direccion') ? 'font-medium text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {errorDe('direccion') || (despacho ? 'Viene de tu perfil; cámbiala si esta vez es otro lugar.' : 'Te avisamos cuando esté listo para recoger.')}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label htmlFor="carro-telefono" className={LABEL}>
                    Teléfono de contacto
                  </label>
                  <input
                    id="carro-telefono"
                    type="tel"
                    inputMode="tel"
                    maxLength={20}
                    value={datos.telefono}
                    onChange={(e) => cambiar('telefono', e.target.value.replace(/[^\d+\s-]/g, ''))}
                    onBlur={() => tocar('telefono')}
                    placeholder="300 123 4567"
                    aria-invalid={Boolean(errorDe('telefono'))}
                    className={`${INPUT} ${errorDe('telefono') ? BORDER_ERR : BORDER_OK}`}
                  />
                  {errorDe('telefono') && <p className="mt-1 text-xs font-medium text-red-500">{errorDe('telefono')}</p>}
                </div>
                <div>
                  <label htmlFor="carro-fecha" className={LABEL}>
                    ¿Para cuándo las necesitas?
                  </label>
                  <input
                    id="carro-fecha"
                    type="date"
                    min={hoyISO()}
                    max={enSeisMeses()}
                    value={datos.fechaRequerida}
                    onChange={(e) => cambiar('fechaRequerida', e.target.value)}
                    onBlur={() => tocar('fechaRequerida')}
                    aria-invalid={Boolean(errorDe('fechaRequerida'))}
                    className={`${INPUT} ${errorDe('fechaRequerida') ? BORDER_ERR : BORDER_OK}`}
                  />
                  <p className={`mt-1 text-xs ${errorDe('fechaRequerida') ? 'font-medium text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    {errorDe('fechaRequerida') || 'Opcional'}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="carro-observaciones" className={LABEL}>
                  Observaciones <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea
                  id="carro-observaciones"
                  rows={3}
                  maxLength={MAX_OBSERVACIONES}
                  value={datos.observaciones}
                  onChange={(e) => cambiar('observaciones', e.target.value)}
                  placeholder="Ej.: son para el eje trasero del camión; llamar antes de llevar."
                  className={`${INPUT} ${errorDe('observaciones') ? BORDER_ERR : BORDER_OK} resize-y`}
                />
                <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {datos.observaciones.length}/{MAX_OBSERVACIONES}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <AvisoError mensaje={errorEnvio} />
              <button
                type="button"
                onClick={crearSolicitud}
                disabled={enviando}
                className="ml-pulsable inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              >
                <FilePlus2 size={17} aria-hidden="true" /> {enviando ? 'Creando…' : 'Crear solicitud de cotización'}
              </button>
              <button
                type="button"
                onClick={solicitarPorWhatsApp}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-whatsapp px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
              >
                <FaWhatsapp size={17} aria-hidden="true" /> Solicitar por WhatsApp
              </button>
              {whatsappAbierto && (
                <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
                  Abrimos WhatsApp con tu mensaje. Revísalo y pulsa enviar allí para que lo recibamos.
                </p>
              )}
              <p className="pt-1 text-center text-[11px] text-slate-400 dark:text-slate-500">Sin compromiso: el precio te lo confirmamos en la cotización.</p>
            </div>
          </section>
        </div>
      )}

      {enviada && <CotizacionEnviadaModal numero={enviada.numero} emitida={enviada.emitida} onClose={cerrarAviso} />}
    </div>
  );
}
