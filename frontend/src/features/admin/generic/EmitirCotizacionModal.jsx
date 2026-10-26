import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarClock, TriangleAlert, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import SearchSelect from '../../../components/base/SearchSelect';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, formatoMiles } from '../../../components/base/formStyles';
import { GANANCIA_SUGERIDA, VIGENCIA_COTIZACION_DIAS, ventaSugerida } from '../../../constantes';
import { useDetalle } from '../../../hooks/useDetalle';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { cotizacionesService, proveedoresService } from '../../../services';
import { formatCOP, fechaISO } from '../../../utils/formato';
import { opcionesEmpresas } from '../../../utils/opciones';
import { SkeletonLineas } from '../../../components/base/Skeleton';

/** "$ 1.250.000" o "1.250.000" → 1250000 */
const aNumero = (texto) => Number(String(texto ?? '').replace(/\D/g, '')) || 0;

/** "2026-10-20T15:04:00Z" → "2026-10-20" (formato estándar AAAA-MM-DD) */
const fecha = (iso) => fechaISO(iso);

/**
 * "Confirmar precios y emitir" (Pedidos-Cotización).
 *
 * Por cada llanta de la solicitud el asesor registra el proveedor con el
 * que verificó el precio, el precio de compra (lo que cobra el proveedor) y
 * el de venta (se propone solo: compra + 20 %, y se puede cambiar), y marca
 * que lo verificó hoy. Con todo listo, la API emite la cotización formal con
 * vigencia de 8 días calendario.
 */
export default function EmitirCotizacionModal({ cotizacion: inicial, onEmitida, onClose }) {
  const { documento, cargando, error } = useDetalle({ ...inicial, detalle: undefined }, cotizacionesService);
  const proveedores = useRecurso(proveedoresService);
  const opciones = useMemo(() => opcionesEmpresas(proveedores.filas), [proveedores.filas]);
  const { enviando, errorEnvio, enviar } = useEnvio();
  // Solo se guarda lo que el asesor cambia; lo demás sale de la línea
  const [ediciones, setEdiciones] = useState({});
  const [intento, setIntento] = useState(false);

  const llantas = useMemo(() => (documento.detalle ?? []).filter((l) => l.tipo === 'producto'), [documento.detalle]);
  // Reencauches de la cotización que todavía no tienen precio: sin ellos no se emite
  const serviciosSinPrecio = useMemo(
    () => (documento.detalle ?? []).filter((l) => l.tipo === 'servicio' && !l.solicitudDatos?.precio),
    [documento.detalle],
  );

  // Valores de cada línea: lo que escribió el asesor o, si se re-emite, lo
  // que ya tenía. Sin valores predeterminados (ni el último costo ni el
  // precio de lista): el asesor escribe la compra que le confirmó el
  // proveedor y la venta se propone con la ganancia sugerida.
  const filas = useMemo(
    () =>
      Object.fromEntries(
        llantas.map((l) => {
          const compra = l.costoProveedor || 0;
          const venta = l.precioUnitarioValor || '';
          return [
            l.lineaId,
            {
              proveedorId: l.proveedorLineaId ?? inicial.proveedorId ?? '',
              // Un valor en 0 (sin costo ni precio de lista) se deja vacío
              compra: formatoMiles(String(compra || '')),
              precio: formatoMiles(String(venta)),
              verificado: false,
              ...ediciones[l.lineaId],
            },
          ];
        }),
      ),
    [llantas, inicial.proveedorId, ediciones],
  );

  const cambiar = (id, cambios) => setEdiciones((e) => ({ ...e, [id]: { ...e[id], ...cambios } }));

  /**
   * Al escribir el precio de compra, el de venta se recalcula con la ganancia
   * sugerida, salvo que el asesor ya lo haya cambiado a mano.
   */
  const cambiarCompra = (id, texto) => {
    const compra = formatoMiles(texto);
    const editado = ediciones[id]?.ventaEditada;
    cambiar(id, editado ? { compra } : { compra, precio: aNumero(compra) ? formatoMiles(String(ventaSugerida(aNumero(compra)))) : '' });
  };

  /** Errores de una línea (se muestran después del primer intento). */
  const erroresDe = (l) => {
    const f = filas[l.lineaId] ?? {};
    const precio = aNumero(f.precio);
    const e = {};
    if (!f.proveedorId) e.proveedor = 'Elige el proveedor';
    if (aNumero(f.compra) <= 0) e.compra = 'Escribe el precio que te da el proveedor';
    if (precio <= 0) e.precio = 'Escribe el precio de venta';
    else if (precio < aNumero(f.compra)) e.precio = 'El precio de venta no puede ser menor que el de compra';
    if (!f.verificado) e.verificado = 'Confirma que verificaste el precio con el proveedor';
    return e;
  };

  const hayErrores = llantas.some((l) => Object.keys(erroresDe(l)).length > 0);
  const subtotal = llantas.reduce((s, l) => s + aNumero(filas[l.lineaId]?.precio) * l.cantidad, 0);

  const emitir = (cerrar) => {
    setIntento(true);
    if (hayErrores || serviciosSinPrecio.length > 0) return;
    enviar(async () => {
      await cotizacionesService.emitir(
        documento.id,
        llantas.map((l) => ({
          id: l.lineaId,
          proveedorId: filas[l.lineaId].proveedorId,
          costoProveedor: aNumero(filas[l.lineaId].compra),
          precioUnitario: aNumero(filas[l.lineaId].precio),
        })),
      );
      await onEmitida?.();
    }, cerrar);
  };

  return (
    <Modal
      title="Confirmar precios y emitir"
      subtitle={`${inicial.id} · ${inicial.cliente ?? ''}`}
      icon={<BadgeCheck size={17} />}
      size="xl"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando || cargando || llantas.length === 0 || serviciosSinPrecio.length > 0}
            onClick={() => emitir(cerrar)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:opacity-60"
          >
            <BadgeCheck size={16} /> {enviando ? 'Emitiendo…' : 'Emitir cotización formal'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <AvisoError mensaje={error || errorEnvio} />
        {cargando && <SkeletonLineas lineas={4} />}

        {/* Con reencauche: su precio se define en "Solicitudes de servicio" antes de emitir */}
        {serviciosSinPrecio.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            <Wrench size={15} className="mt-px shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Esta cotización incluye reencauche sin precio.</p>
              <p className="mt-0.5">
                Asigna el precio de {serviciosSinPrecio.map((l) => l.solicitud).filter(Boolean).join(', ') || 'el servicio'} en{' '}
                <Link to="/admin/solicitudes-servicio" className="font-semibold underline underline-offset-2">
                  Solicitudes de servicio
                </Link>{' '}
                para poder emitir la cotización.
              </p>
            </div>
          </div>
        )}

        {inicial.etapa === 'Vencida' && (
          <p className="flex items-start gap-2 rounded-lg border border-red-400/50 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
            <TriangleAlert size={14} className="mt-px shrink-0" /> La cotización venció: confirma de nuevo los
            precios vigentes para volver a emitirla.
          </p>
        )}

        <ul className="space-y-3">
          {llantas.map((l) => {
            const f = filas[l.lineaId] ?? {};
            const e = intento ? erroresDe(l) : {};
            return (
              <li key={l.lineaId} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {l.nombre} <span className="font-normal text-slate-400">· {l.codigo} · {l.medida}</span>
                  </p>
                  <span className="text-xs font-semibold text-slate-500">{l.cantidad} und.</span>
                </div>
                {l.costoConfirmadoEn && (
                  <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                    Verificado antes el {fecha(l.costoConfirmadoEn)} con {l.proveedorLinea}: vuelve a verificarlo.
                  </p>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <span className={LABEL}>Proveedor</span>
                    <SearchSelect
                      value={f.proveedorId}
                      options={opciones}
                      onChange={(id) => cambiar(l.lineaId, { proveedorId: id })}
                      placeholderBusqueda="Razón social o NIT"
                      error={Boolean(e.proveedor)}
                    />
                    {e.proveedor && <p className="mt-1 text-xs text-red-500">{e.proveedor}</p>}
                  </div>
                  <div>
                    <label className={LABEL} htmlFor={`compra-${l.lineaId}`}>
                      Precio de compra (c/u)
                    </label>
                    <input
                      id={`compra-${l.lineaId}`}
                      inputMode="numeric"
                      value={f.compra ?? ''}
                      onChange={(ev) => cambiarCompra(l.lineaId, ev.target.value)}
                      className={`${INPUT} ${e.compra ? BORDER_ERR : BORDER_OK}`}
                    />
                    {e.compra ? (
                      <p className="mt-1 text-xs text-red-500">{e.compra}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">Lo que cobra el proveedor</p>
                    )}
                  </div>
                  <div>
                    <label className={LABEL} htmlFor={`precio-${l.lineaId}`}>
                      Precio de venta (c/u)
                    </label>
                    <input
                      id={`precio-${l.lineaId}`}
                      inputMode="numeric"
                      value={f.precio ?? ''}
                      onChange={(ev) => cambiar(l.lineaId, { precio: formatoMiles(ev.target.value), ventaEditada: true })}
                      className={`${INPUT} ${e.precio ? BORDER_ERR : BORDER_OK}`}
                    />
                    {e.precio ? (
                      <p className="mt-1 text-xs text-red-500">{e.precio}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {filas[l.lineaId]?.ventaEditada ? 'Editado a mano' : `Compra + ${GANANCIA_SUGERIDA * 100} %`} · Subtotal:{' '}
                        {formatCOP(aNumero(f.precio) * l.cantidad)}
                      </p>
                    )}
                  </div>
                </div>

                <label className="mt-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(f.verificado)}
                    onChange={(ev) => cambiar(l.lineaId, { verificado: ev.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-amber-500"
                  />
                  Verifiqué hoy el precio de esta llanta con el proveedor.
                </label>
                {e.verificado && <p className="mt-1 text-xs text-red-500">{e.verificado}</p>}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-3">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <CalendarClock size={15} className="text-amber-500" /> Vigencia: {VIGENCIA_COTIZACION_DIAS} días calendario desde
            hoy (la fecha la fija el servidor).
          </span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCOP(subtotal)}</span>
        </div>
      </div>
    </Modal>
  );
}
