import { useState } from 'react';
import { HandCoins, Pencil, Save, Trash2, Wrench } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Badge from '../../../components/base/Badge';
import StatusSelect from '../../../components/base/StatusSelect';
import { BORDER_OK, INPUT, formatoMiles } from '../../../components/base/formStyles';
import { estadosServicio, FLUJO_ESTADOS_SERVICIO } from '../../../constantes';
import { parseCOP } from '../../../utils/formato';
import { TONO_PAGO } from './tonosPago';

/**
 * Tarjeta de una solicitud de reencauche, dentro del desplegable de su
 * cotización en "Solicitudes de servicio".
 *
 * Aquí el asesor:
 *   · asigna el valor del servicio (el cliente recibe el aviso para pagarlo);
 *   · revisa el pago ("Ver pago");
 *   · avanza el estado del reencauche (solo con el pago aprobado);
 *   · edita los datos o elimina la solicitud si no viene de una cotización.
 *
 * props: solicitud, onPrecio(precio), onEstado(estado), onVerPago(),
 *        onEditar(), onEliminar() — las acciones devuelven promesas.
 */
export default function TarjetaSolicitudServicio({ solicitud, onPrecio, onEstado, onVerPago, onEditar, onEliminar }) {
  const [precio, setPrecio] = useState(solicitud.precio ? formatoMiles(String(parseCOP(solicitud.precio))) : '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Después de pagado (o con el pago en revisión) el valor ya no cambia
  const precioFijo = ['En revisión', 'Aprobado'].includes(solicitud.pagoEstado);
  const cambioPrecio = parseCOP(precio) > 0 && parseCOP(precio) !== parseCOP(solicitud.precio);

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
            <Badge tone={TONO_PAGO[solicitud.pagoEstado]}>Pago: {solicitud.pagoEstado}</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {solicitud.medidas || 'Sin medidas'} · Carcasa: {solicitud.estadoEvidencia} · {solicitud.tercero || 'Sin reencauchadora'}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{solicitud.descripcion}</p>
        </div>
      </div>

      <AvisoError mensaje={error} className="mt-3" />

      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
        {/* ---- Valor del servicio ---- */}
        <label className="min-w-[180px] flex-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Valor del servicio</span>
          <div className="mt-1 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input
                inputMode="numeric"
                value={precio}
                disabled={precioFijo}
                onChange={(e) => setPrecio(formatoMiles(e.target.value))}
                placeholder="Asignar valor"
                aria-label={`Valor del servicio ${solicitud.id}`}
                className={`${INPUT} ${BORDER_OK} pl-7 disabled:opacity-60`}
              />
            </div>
            {!precioFijo && (
              <button
                type="button"
                onClick={() => intentar(() => onPrecio(parseCOP(precio)))}
                disabled={guardando || !cambioPrecio}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-40"
                title="Guardar el valor y avisar al cliente"
              >
                <Save size={14} /> Guardar
              </button>
            )}
          </div>
        </label>

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
