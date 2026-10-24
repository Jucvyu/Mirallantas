import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Disc3, Minus, Pencil, Plus, Send, ShoppingCart, Trash2, Wrench, X } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_ERR, BORDER_OK, INPUT, SECTION as SECTION_TEXT, soloDigitos } from '../../components/base/formStyles';
import { WHATSAPP_EMPRESA } from '../../config';
import { enlaceWhatsApp, mensajeCotizacion } from '../../utils/whatsapp';
import { SERVICIO_POR_DEFECTO } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { CANTIDAD_MAXIMA, useCart } from '../../context/CartContext';
import { usePortal } from '../../context/PortalContext';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService, nuevaClaveIdempotencia } from '../../services';
import SolicitudReencaucheModal from './SolicitudReencaucheModal';
import CotizacionEnviadaModal from './CotizacionEnviadaModal';
import Tooltip from '../../components/base/Tooltip';

/**
 * Carro de cotización del cliente (columna derecha del catálogo).
 *
 * Muestra las llantas y servicios elegidos con su cantidad, que se puede
 * cambiar o quitar, y el lugar de despacho (por defecto la dirección del
 * perfil; se puede cambiar solo para esta solicitud). No muestra precios,
 * subtotales, totales ni stock.
 *
 * Dos formas de pedir la cotización:
 *   - "Enviar solicitud": la registra en el sistema; un asesor verifica
 *     los precios y emite la cotización formal.
 *   - "Solicitar por WhatsApp": abre WhatsApp con el mensaje escrito (nombre,
 *     lugar de despacho y productos con cantidades, sin precios). El envío
 *     lo hace el cliente desde WhatsApp: aquí no se da por enviado.
 *
 * El envío lleva una clave anti-duplicados: un doble clic o un reintento no
 * crea dos solicitudes. El aviso de confirmación solo aparece cuando la API
 * responde que quedó registrada.
 */
export default function PedidoPanel({ onClose = null }) {
  const navigate = useNavigate();
  const cart = useCart();
  const { usuario } = useAuth();
  const { recargar } = usePortal();
  const { enviando, errorEnvio, enviar } = useEnvio();

  const [servicioModal, setServicioModal] = useState(false);
  // Servicio del carro que se está editando (null = ninguno)
  const [servicioEditado, setServicioEditado] = useState(null);
  // Número de la solicitud registrada (abre el aviso de confirmación)
  const [enviada, setEnviada] = useState(null);
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClaveIdempotencia);
  const [aviso, setAviso] = useState('');
  // Lugar de despacho: la dirección del perfil, editable solo para esta solicitud
  const [lugar, setLugar] = useState(usuario.direccion ?? '');
  const [lugarTocado, setLugarTocado] = useState(false);
  const [whatsappAbierto, setWhatsappAbierto] = useState(false);

  const vacio = cart.count === 0;
  const lugarLimpio = lugar.trim();
  const errorLugar = !lugarLimpio
    ? 'Indica dónde quieres recibir o recoger el pedido'
    : lugarLimpio.length > 200
      ? 'Máximo 200 caracteres'
      : '';

  /** Guarda el servicio del formulario: uno nuevo o los cambios de uno existente. */
  const guardarServicio = (values) => {
    const datos = {
      servicio: SERVICIO_POR_DEFECTO,
      cantidad: Number(values.cantidad) || 1,
      medidas: values.medidas ?? '',
      // Hasta 3 fotos; la primera también va como foto principal
      fotos: values.fotos ?? (values.foto ? [values.foto] : []),
      foto: values.fotos?.[0] ?? values.foto,
      descripcion: values.descripcion,
      estadoEvidencia: 'Pendiente de revisión',
    };
    if (servicioEditado) cart.updateServicio(servicioEditado.id, datos);
    else cart.addServicio(datos);
  };

  const enviarSolicitud = () => {
    setLugarTocado(true);
    if (errorLugar) return;
    setAviso('');
    enviar(async () => {
      const { datos: solicitud } = await cotizacionesService.crearDesdePortal({
        direccion: lugarLimpio,
        productos: cart.productos,
        servicios: cart.servicios,
        claveIdempotencia,
      });
      setClaveIdempotencia(nuevaClaveIdempotencia());
      await recargar();
      setEnviada(solicitud.numero);
    });
  };

  /**
   * Abre WhatsApp con el mensaje ya escrito. Solo lo abre: el cliente lo
   * revisa y lo envía desde WhatsApp, así que aquí no se limpia el carro ni
   * se dice que se envió.
   */
  const solicitarPorWhatsApp = () => {
    setLugarTocado(true);
    if (errorLugar) return;
    const texto = mensajeCotizacion({
      nombre: usuario.nombre,
      lugar: lugarLimpio,
      productos: cart.productos,
      servicios: cart.servicios,
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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800">
        <div className="h-[3px] w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400/0" />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-400">
              <ShoppingCart size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Mi carro de cotización</p>
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
              <Wrench size={15} /> Reencauche
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100"
                aria-label="Cerrar el carro"
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
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tu carro está vacío</p>
            <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
              Agrega llantas desde el catálogo o pide un reencauche.
            </p>
            {!onClose && (
              <Link to="/portal/catalogo" className="mt-1 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300">
                Ir al catálogo
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {/* ---- Llantas: descripción, medida y cantidad ---- */}
            {cart.productos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <TireThumb brand={p.marca} foto={p.foto} className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-amber-500 dark:text-amber-400">{p.marca.toUpperCase()}</p>
                  <p className="break-words text-sm font-bold leading-snug text-slate-900 dark:text-white">{p.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Medida {p.medidas}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => cart.setCantidad(p.id, p.cantidad - 1)}
                    disabled={p.cantidad <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Una llanta menos"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    inputMode="numeric"
                    value={p.cantidad}
                    onChange={(e) => cart.setCantidad(p.id, soloDigitos(e.target.value))}
                    aria-label={`Cantidad de ${p.nombre}`}
                    className={`${INPUT} ${BORDER_OK} !w-12 !px-1 !py-1 text-center`}
                  />
                  <button
                    onClick={() => cart.setCantidad(p.id, p.cantidad + 1)}
                    disabled={p.cantidad >= CANTIDAD_MAXIMA}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Una llanta más"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={() => cart.removeProducto(p.id)}
                    className="ml-1 rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                    aria-label={`Quitar ${p.nombre} del carro`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}

            {/* ---- Servicios de reencauche ---- */}
            {cart.servicios.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-5 py-4">
                {s.foto ? (
                  <img src={s.foto} alt="Carcasa" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/5">
                    <Wrench size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-blue-500 dark:text-blue-400">SERVICIO</p>
                  <p className="text-sm font-bold leading-snug text-slate-900 dark:text-white">{s.servicio}</p>
                  <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{s.descripcion}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge>{s.estadoEvidencia}</Badge>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{s.cantidad} llantas</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Tooltip texto="Editar las medidas, fotos o descripción del reencauche">
                    <button
                      onClick={() => setServicioEditado(s)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-amber-500"
                      aria-label="Editar el servicio"
                    >
                      <Pencil size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip texto="Quitar este reencauche del carro">
                    <button
                      onClick={() => cart.removeServicio(s.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                      aria-label="Quitar el servicio del carro"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================= Envío de la solicitud ================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
        <label htmlFor="pp-lugar" className={SECTION_TEXT}>
          Lugar de despacho
        </label>
        <input
          id="pp-lugar"
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          onBlur={() => setLugarTocado(true)}
          placeholder="Calle 50 #45-12, Medellín"
          aria-invalid={lugarTocado && Boolean(errorLugar)}
          className={`${INPUT} ${lugarTocado && errorLugar ? BORDER_ERR : BORDER_OK} mt-2`}
        />
        <p className={`mt-1 text-xs ${lugarTocado && errorLugar ? 'font-medium text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
          {lugarTocado && errorLugar ? errorLugar : 'Viene de tu perfil; cámbialo solo si esta vez es otro lugar.'}
        </p>

        <div className="mt-5 space-y-2">
          <AvisoError mensaje={errorEnvio || aviso} />
          <button
            onClick={enviarSolicitud}
            disabled={vacio || enviando}
            className="ml-pulsable inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Send size={16} /> {enviando ? 'Enviando…' : 'Enviar solicitud de cotización'}
          </button>
          <button
            onClick={solicitarPorWhatsApp}
            disabled={vacio}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-whatsapp px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FaWhatsapp size={17} /> Solicitar por WhatsApp
          </button>
          {whatsappAbierto && (
            <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
              Abrimos WhatsApp con tu mensaje. Revísalo y pulsa enviar allí para que lo recibamos.
            </p>
          )}
          <button
            onClick={() => (onClose ? onClose() : navigate('/portal/catalogo'))}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Seguir explorando
          </button>
        </div>
      </div>

      {(servicioModal || servicioEditado) && (
        <SolicitudReencaucheModal
          inicial={servicioEditado}
          onGuardar={guardarServicio}
          onClose={() => {
            setServicioModal(false);
            setServicioEditado(null);
          }}
        />
      )}

      {enviada && <CotizacionEnviadaModal numero={enviada} onClose={cerrarAviso} />}
    </div>
  );
}
