import { useState } from 'react';
import { HandCoins, Pencil, Save, Trash2, Wrench } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import StatusSelect from '../../../components/base/StatusSelect';
import { BORDER_OK, INPUT, formatoMiles } from '../../../components/base/formStyles';
import { estadosServicio, FLUJO_ESTADOS_SERVICIO, GANANCIA_SUGERIDA, ventaSugerida } from '../../../constantes';
import { parseCOP } from '../../../utils/formato';
import { TONO_PAGO } from './tonosPago';

/**
 * Tarjeta de una solicitud de reencauche, dentro del desplegable de su
 * cotización en "Solicitudes de servicio".
 *
 * Aquí el asesor:
 *   · asigna el precio de compra (tercero) y el de venta, que se propone con
 *     un 20 % de ganancia (el cliente recibe el aviso para pagarlo);
 *   · revisa el pago ("Ver pago");
 *   · avanza el estado del reencauche (solo con el pago aprobado);
 *   · edita los datos o elimina la solicitud si no viene de una cotización.
 *
 * props: solicitud, onPrecio({ costo, precio }), onEstado(estado), onVerPago(),
 *        onEditar(), onEliminar() — las acciones devuelven promesas.
 */
export default function TarjetaSolicitudServicio({ solicitud, onPrecio, onEstado, onVerPago, onEditar, onEliminar }) {
  const [compra, setCompra] = useState(solicitud.costo ? formatoMiles(String(solicitud.costo)) : '');
  const [precio, setPrecio] = useState(solicitud.precio ? formatoMiles(String(parseCOP(solicitud.precio))) : '');
  // Si el asesor cambia el precio de venta a mano, la compra ya no lo recalcula
  const [ventaEditada, setVentaEditada] = useState(Boolean(solicitud.precio));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Después de pagado (o con el pago en revisión) el valor ya no cambia
  const precioFijo = ['En revisión', 'Aprobado'].includes(solicitud.pagoEstado);
  const cambioPrecio = !precioFijo && parseCOP(precio) > 0 && parseCOP(precio) !== parseCOP(solicitud.precio);
  const cambioCompra = parseCOP(compra) > 0 && parseCOP(compra) !== (solicitud.costo ?? 0);

  /** El precio de compra propone el de venta (+20 %) mientras no se edite a mano. */
  const alCambiarCompra = (texto) => {
    const nueva = formatoMiles(texto);
    setCompra(nueva);
    if (!ventaEditada && !precioFijo) setPrecio(parseCOP(nueva) ? formatoMiles(String(ventaSugerida(parseCOP(nueva)))) : '');
  };

  /** Ejecuta una acción y muestra su error en la tarjeta. */
  const intentar = async (accion) => {
    setError('');
    setGuardando(true);
    try {
      await accion();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <article
      className={`rounded-xl border bg-white p-4 dark:bg-brand-navy-800 ${
        solicitud.pagoEstado === 'En revisión'
          ? 'border-amber-400'
          : solicitud.pagoEstado === 'Rechazado'
            ? 'border-red-400'
            : 'border-slate-200 dark:border-white/10'
      }`}
    >
      <div className="flex gap-3">
        {solicitud.foto ? (
          <a href={solicitud.foto} target="_blank" rel="noreferrer" title="Ver la foto de la carcasa">
            <img src={solicitud.foto} alt="Carcasa" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
          </a>
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/5">
            <Wrench size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {solicitud.id} · {solicitud.cantidad} llantas
            </p>
            {solicitud.incluidoEnCotizacion ? (
              // Va dentro del total de la cotización: se paga con ella
              <Badge tone={solicitud.pagoEstado === 'Aprobado' ? TONO_PAGO.Aprobado : undefined}>
                {solicitud.pagoEstado === 'Aprobado' ? 'Pagado con la cotización' : 'Se paga con la cotización'}
              </Badge>
            ) : (
              <Badge tone={TONO_PAGO[solicitud.pagoEstado]}>Pago: {solicitud.pagoEstado}</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {solicitud.medidas || 'Sin medidas'} · Carcasa: {solicitud.estadoEvidencia} · {solicitud.tercero || 'Sin reencauchadora'}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{solicitud.descripcion}</p>
        </div>
      </div>

      <AvisoError mensaje={error} className="mt-3" />

      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
        {/* ---- Precio de compra (tercero) y de venta (cliente) ---- */}
        <div className="flex min-w-[280px] flex-1 items-end gap-2">
          <label className="flex-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Precio de compra</span>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                inputMode="numeric"
                value={compra}
                onChange={(e) => alCambiarCompra(e.target.value)}
                placeholder="Lo que cobra el tercero"
                aria-label={`Precio de compra del servicio ${solicitud.id}`}
                className={`${INPUT} ${BORDER_OK} pl-7`}
              />
            </div>
          </label>
          <label className="flex-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Precio de venta {!ventaEditada && compra ? `(compra + ${GANANCIA_SUGERIDA * 100} %)` : ''}
            </span>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                inputMode="numeric"
                value={precio}
                disabled={precioFijo}
                onChange={(e) => {
                  setPrecio(formatoMiles(e.target.value));
                  setVentaEditada(true);
                }}
                placeholder="Lo que paga el cliente"
                aria-label={`Precio de venta del servicio ${solicitud.id}`}
                className={`${INPUT} ${BORDER_OK} pl-7 disabled:opacity-60`}
              />
            </div>
          </label>
          <button
            type="button"
            onClick={() =>
              intentar(() =>
                onPrecio({
                  costo: cambioCompra ? parseCOP(compra) : undefined,
                  precio: cambioPrecio ? parseCOP(precio) : undefined,
                }),
              )
            }
            disabled={guardando || (!cambioPrecio && !cambioCompra)}
            className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-40"
            title={cambioPrecio ? 'Guardar y avisar al cliente el valor' : 'Guardar el precio de compra'}
          >
            <Save size={14} /> Guardar
          </button>
        </div>

        {/* ---- Estado del reencauche ---- */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Estado</span>
          <div className="mt-1">
            <StatusSelect
              value={solicitud.estado}
              options={estadosServicio}
              flow={FLUJO_ESTADOS_SERVICIO}
              onChange={(estado) => intentar(() => onEstado(estado))}
            />
          </div>
        </div>

        {/* ---- Acciones ---- */}
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={onVerPago}
            className={`rounded p-1.5 hover:text-amber-500 ${solicitud.pagoEstado === 'En revisión' ? 'text-amber-500' : ''}`}
            title="Ver pago y comprobante"
            aria-label={`Ver el pago de ${solicitud.id}`}
          >
            <HandCoins size={16} />
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="rounded p-1.5 hover:text-slate-700 dark:hover:text-slate-200"
            title="Editar la solicitud"
            aria-label={`Editar ${solicitud.id}`}
          >
            <Pencil size={16} />
          </button>
          {!solicitud.cotizacion && solicitud.estado === 'Pendiente' && (
            <button
              type="button"
              onClick={() => intentar(onEliminar)}
              className="rounded p-1.5 hover:text-red-500"
              title="Eliminar la solicitud"
              aria-label={`Eliminar ${solicitud.id}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
