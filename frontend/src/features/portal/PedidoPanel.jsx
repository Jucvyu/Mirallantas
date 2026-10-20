import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Disc3, Info, Minus, Pencil, Plus, Send, ShoppingCart, Trash2, Wrench, X } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import FormModal from '../../components/base/FormModal';
import TireThumb from '../../components/base/TireThumb';
import { BORDER_OK, INPUT, SECTION as SECTION_TEXT, soloDigitos } from '../../components/base/formStyles';
import { PLAZO_RESPUESTA_HORAS, SERVICIO_POR_DEFECTO } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { CANTIDAD_MAXIMA, useCart } from '../../context/CartContext';
import { usePortal } from '../../context/PortalContext';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService, nuevaClaveIdempotencia } from '../../services';
import { servicioInitialValues, servicioSectionsCliente } from '../shared/servicioSections';
import CotizacionEnviadaModal from './CotizacionEnviadaModal';

/**
 * Carro de cotización del cliente (columna derecha del catálogo).
 *
 * Muestra las llantas y servicios elegidos con su cantidad, que se puede
 * cambiar o quitar. No muestra precios, subtotales, totales ni stock:
 * enviar el carro registra una SOLICITUD de cotización; un asesor confirma
 * los precios con los proveedores y emite la cotización formal, que el
 * cliente acepta después eligiendo cómo pagar.
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

  const vacio = cart.count === 0;

  /** Guarda el servicio del formulario: uno nuevo o los cambios de uno existente. */
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

  const enviarSolicitud = () => {
    // La dirección de despacho es la del perfil del cliente
    if (!usuario.direccion) {
      setAviso('Agrega tu dirección en "Mi perfil" para saber a dónde despachar el pedido.');
      return;
    }
    setAviso('');
    enviar(async () => {
      const { datos: solicitud } = await cotizacionesService.crearDesdePortal({
        direccion: usuario.direccion,
        productos: cart.productos,
        servicios: cart.servicios,
        claveIdempotencia,
      });
      setClaveIdempotencia(nuevaClaveIdempotencia());
      await recargar();
      setEnviada(solicitud.numero);
    });
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
                    aria-label="Quitar el servicio del carro"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================= Envío de la solicitud ================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
        <p className={SECTION_TEXT}>Solicitud de cotización</p>
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <Info size={14} className="mt-px shrink-0 text-amber-500" />
          No es una compra: confirmamos los precios con nuestros proveedores y te enviamos la cotización formal en
          hasta {PLAZO_RESPUESTA_HORAS} horas. Ahí eliges si pagas de contado o a crédito.
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
            onClick={() => (onClose ? onClose() : navigate('/portal/catalogo'))}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
          >
            Seguir explorando
          </button>
        </div>
      </div>

      {(servicioModal || servicioEditado) && (
        <FormModal
          mode={servicioEditado ? 'edit' : 'create'}
          title={servicioEditado ? 'Editar servicio' : 'Pedir reencauche'}
          subtitle="Sube la foto de la carcasa para que el asesor evalúe si es apta. El valor lo define el asesor y se paga aparte."
          sections={servicioSectionsCliente}
          initialValues={servicioEditado ?? servicioInitialValues}
          submitLabel={servicioEditado ? 'Guardar cambios' : 'Agregar al carro'}
          onSubmit={guardarServicio}
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
