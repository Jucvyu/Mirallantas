import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarClock, TriangleAlert } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import SearchSelect from '../../../components/base/SearchSelect';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, formatoMiles } from '../../../components/base/formStyles';
import { VIGENCIA_COTIZACION_DIAS } from '../../../constantes';
import { useDetalle } from '../../../hooks/useDetalle';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { cotizacionesService, proveedoresService } from '../../../services';
import { formatCOP } from '../../../utils/formato';
import { opcionesEmpresas } from '../../../utils/opciones';

/** "$ 1.250.000" o "1.250.000" → 1250000 */
const aNumero = (texto) => Number(String(texto ?? '').replace(/\D/g, '')) || 0;

/** "2026-10-20T15:04:00Z" → "20/10/2026" */
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO') : '');

/**
 * "Confirmar precios y emitir" (Pedidos-Cotización).
 *
 * Por cada llanta de la solicitud el asesor registra el proveedor con el
 * que verificó el precio y el precio de venta definitivo (se sugiere el del
 * catálogo, si tiene), y marca que lo verificó hoy. Con todo listo, la API
 * emite la cotización formal con vigencia de 8 días calendario. El costo
 * del proveedor ya no se pide aquí.
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

  // Valores de cada línea: lo que escribió el asesor o, si no, lo de antes
  // (si se re-emite) o el proveedor de la cotización y el precio sugerido.
  const filas = useMemo(
    () =>
      Object.fromEntries(
        llantas.map((l) => [
          l.lineaId,
          {
            proveedorId: l.proveedorLineaId ?? inicial.proveedorId ?? '',
            // Un precio sugerido en 0 (productos sin precio de lista) se deja vacío
            precio: formatoMiles(String(l.precioUnitarioValor || l.precioSugerido || '')),
            verificado: false,
            ...ediciones[l.lineaId],
          },
        ]),
      ),
    [llantas, inicial.proveedorId, ediciones],
  );

  const cambiar = (id, cambios) => setEdiciones((e) => ({ ...e, [id]: { ...e[id], ...cambios } }));

  /** Errores de una línea (se muestran después del primer intento). */
  const erroresDe = (l) => {
    const f = filas[l.lineaId] ?? {};
    const precio = aNumero(f.precio);
    const e = {};
    if (!f.proveedorId) e.proveedor = 'Elige el proveedor';
    if (precio <= 0) e.precio = 'Escribe el precio de venta';
    if (!f.verificado) e.verificado = 'Confirma que verificaste el precio con el proveedor';
    return e;
  };

  const hayErrores = llantas.some((l) => Object.keys(erroresDe(l)).length > 0);
  const subtotal = llantas.reduce((s, l) => s + aNumero(filas[l.lineaId]?.precio) * l.cantidad, 0);

  const emitir = (cerrar) => {
    setIntento(true);
    if (hayErrores) return;
    enviar(async () => {
      await cotizacionesService.emitir(
        documento.id,
        llantas.map((l) => ({
          id: l.lineaId,
          proveedorId: filas[l.lineaId].proveedorId,
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
            disabled={enviando || cargando || llantas.length === 0}
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
        {cargando && <p className="text-sm text-slate-400">Cargando las llantas de la solicitud…</p>}

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

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <label className={LABEL} htmlFor={`precio-${l.lineaId}`}>
                      Precio de venta (c/u)
                    </label>
                    <input
                      id={`precio-${l.lineaId}`}
                      inputMode="numeric"
                      value={f.precio ?? ''}
                      onChange={(ev) => cambiar(l.lineaId, { precio: formatoMiles(ev.target.value) })}
                      className={`${INPUT} ${e.precio ? BORDER_ERR : BORDER_OK}`}
                    />
                    {e.precio ? (
                      <p className="mt-1 text-xs text-red-500">{e.precio}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Subtotal: {formatCOP(aNumero(f.precio) * l.cantidad)}
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
