import { useState } from 'react';
import { Ban, ClipboardCheck, HandCoins, Pencil, Save, Trash2, Wrench } from 'lucide-react';
import BotonAccion from '../../../components/base/BotonAccion';
import MotivoModal from '../../../components/base/MotivoModal';
import RevisionCarcasaModal from './RevisionCarcasaModal';
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
 * props: solicitud, onPrecio({ costo, precio }), onRevisar({ estadoEvidencia, observacionRevision }),
 *        onEstado(estado), onVerPago(),
 *        onEditar(), onEliminar() — las acciones devuelven promesas.
 */
export default function TarjetaSolicitudServicio({ solicitud, onPrecio, onRevisar, onEstado, onVerPago, onEditar, onEliminar }) {
  // false | true | 'avance' | 'precio' (se intentó avanzar o poner precio sin revisar: la revisión es obligatoria)
  const [revisando, setRevisando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  // Con la carcasa aprobada ("Apta"), los datos de la llanta ya no se editan
  const aprobada = solicitud.estadoEvidencia === 'Apta';
  // Terminado o cancelado, tampoco
  const cerrada = ['Completado', 'Cancelado'].includes(solicitud.estado);
  // Cancelado (a mano o por una carcasa no apta): el proceso queda cerrado
  const cancelada = solicitud.estado === 'Cancelado';
  // La revisión se registra una sola vez; después el botón la muestra
  const revisada = solicitud.estadoEvidencia !== 'Pendiente de revisión';

  /** Cambio de estado: cancelar pide el motivo; avanzar exige la carcasa revisada (Apta). */
  const cambiarEstado = (estado) => {
    if (estado === 'Cancelado') return setCancelando(true);
    if (!aprobada) return setRevisando('avance');
    return intentar(() => onEstado(estado));
  };
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
  // Regla de negocio: la venta nunca por debajo de la compra
  const ventaBaja = parseCOP(compra) > 0 && parseCOP(precio) > 0 && parseCOP(precio) < parseCOP(compra);

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
          {solicitud.observacionRevision && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Revisión:</span> {solicitud.observacionRevision}
              {aprobada && ` · ${solicitud.garantia === 'Sí' || solicitud.garantia === true ? 'Con garantía' : 'Sin garantía'}`}
            </p>
          )}
        </div>
      </div>

      <AvisoError mensaje={error} className="mt-3" />

      {cancelada ? (
        // ---- Cancelado: en vez de los campos, el detalle de la cancelación
        <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/5 px-3 py-2.5 text-xs dark:bg-red-500/10">
          <p className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
            <Ban size={14} /> Reencauche cancelado
          </p>
          <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="inline font-semibold text-slate-500 dark:text-slate-400">Motivo: </dt>
              <dd className="inline text-slate-700 dark:text-slate-200">{solicitud.motivoCancelacion || 'Sin motivo registrado'}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-slate-500 dark:text-slate-400">Carcasa: </dt>
              <dd className="inline text-slate-700 dark:text-slate-200">{solicitud.estadoEvidencia}</dd>
            </div>
            {solicitud.precio && (
              <div>
                <dt className="inline font-semibold text-slate-500 dark:text-slate-400">Valor: </dt>
                <dd className="inline text-slate-700 dark:text-slate-200">{solicitud.precio}</dd>
              </div>
            )}
          </dl>
        </div>
      ) : null}

      <div className={`mt-3 flex flex-wrap items-end gap-3 ${cancelada ? '' : 'border-t border-slate-100 pt-3 dark:border-white/10'}`}>
        {!cancelada && (
          <>
            {/* ---- Precio de compra (tercero) y de venta (cliente): solo con la carcasa Apta ---- */}
            {!revisada && (
              <p className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Antes de asignar el precio, revisa si la carcasa es apta.
                <button type="button" onClick={() => setRevisando('precio')} className="font-bold underline hover:no-underline">
                  Revisar carcasa
                </button>
              </p>
            )}
            <div className="flex min-w-[280px] flex-1 items-end gap-2">
              <label className="flex-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Precio de compra</span>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    inputMode="numeric"
                    value={compra}
                    disabled={!aprobada}
                    onChange={(e) => alCambiarCompra(e.target.value)}
                    placeholder="Lo que cobra el tercero"
                    aria-label={`Precio de compra del servicio ${solicitud.id}`}
                    className={`${INPUT} ${BORDER_OK} pl-7 disabled:opacity-60`}
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
                    disabled={precioFijo || !aprobada}
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
                disabled={!aprobada || guardando || ventaBaja || (!cambioPrecio && !cambioCompra)}
                className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-40"
                title={cambioPrecio ? 'Guardar y avisar al cliente el valor' : 'Guardar el precio de compra'}
              >
                <Save size={14} /> Guardar
              </button>
            </div>
            {ventaBaja && (
              <p className="w-full text-xs font-medium text-red-500">El precio de venta no puede ser menor que el precio de compra.</p>
            )}

            {/* ---- Estado del reencauche ---- */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Estado</span>
              <div className="mt-1">
                <StatusSelect value={solicitud.estado} options={estadosServicio} flow={FLUJO_ESTADOS_SERVICIO} onChange={cambiarEstado} />
              </div>
            </div>
          </>
        )}

        {/* ---- Acciones ---- */}
        <div className="flex items-center gap-1">
          <BotonAccion
            icono={ClipboardCheck}
            etiqueta={
              revisada ? `Ver la revisión de la carcasa (${solicitud.estadoEvidencia})` : 'Revisar la carcasa (aprobar o marcar no apta)'
            }
            tono={revisada ? 'acento' : 'destacado'}
            onClick={() => setRevisando(true)}
          />
          {!cancelada && (
            <BotonAccion
              icono={HandCoins}
              etiqueta="Ver pago y comprobante"
              tono={solicitud.pagoEstado === 'En revisión' ? 'destacado' : 'acento'}
              onClick={onVerPago}
            />
          )}
          <BotonAccion
            icono={Pencil}
            etiqueta="Editar la solicitud"
            deshabilitado={aprobada || cerrada}
            motivo={cerrada ? `El reencauche está "${solicitud.estado}"` : 'Ya fue aprobada: sus datos no se editan'}
            onClick={onEditar}
          />
          <BotonAccion
            icono={Trash2}
            etiqueta="Eliminar la solicitud"
            tono="peligro"
            deshabilitado={Boolean(solicitud.cotizacion) || solicitud.estado !== 'Pendiente'}
            motivo="Solo se elimina una pendiente que no venga de una cotización"
            onClick={() => intentar(onEliminar)}
          />
        </div>
        {revisando && (
          <RevisionCarcasaModal
            solicitud={solicitud}
            aviso={
              revisando === 'avance'
                ? 'Para que el reencauche avance, primero revisa la carcasa y apruébala.'
                : revisando === 'precio'
                  ? 'Antes de asignar el precio, indica si la carcasa es apta.'
                  : undefined
            }
            onConfirmar={onRevisar}
            onClose={() => setRevisando(false)}
          />
        )}
        {cancelando && (
          <MotivoModal
            title="Cancelar el reencauche"
            message="El reencauche queda cancelado con su motivo."
            record={{
              title: `${solicitud.id} · ${solicitud.cantidad} llantas`,
              subtitle: solicitud.medidas,
            }}
            label="Motivo de la cancelación"
            confirmLabel="Cancelar reencauche"
            onConfirm={(motivo) => onEstado('Cancelado', motivo)}
            onClose={() => setCancelando(false)}
          />
        )}
      </div>
    </article>
  );
}
