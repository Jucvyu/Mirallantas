import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarClock, Plus, TriangleAlert, Trash2, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import SearchSelect from '../../../components/base/SearchSelect';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, formatoMiles } from '../../../components/base/formStyles';
import { GANANCIA_SUGERIDA, VIGENCIA_COTIZACION_DIAS } from '../../../constantes';
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

/** Ganancia sugerida en porcentaje (20). */
const GANANCIA_POR_DEFECTO = GANANCIA_SUGERIDA * 100;

/** "17,5" o "17.5" → 17.5 · vacío o inválido → NaN */
const aPorcentaje = (texto) => (String(texto ?? '').trim() === '' ? NaN : Number(String(texto).replace(',', '.')));

/** 17.5 → "17,5" (un decimal como máximo, sin ceros de más) */
const porcentajeATexto = (n) => (Number.isFinite(n) ? String(Math.round(n * 10) / 10).replace('.', ',') : '');

/** Venta = compra + ganancia, redondeada al peso. */
const ventaCon = (compra, ganancia) => Math.round(compra * (1 + ganancia / 100));

/** Ganancia (%) que deja una venta sobre la compra. */
const gananciaDe = (venta, compra) => (compra > 0 ? ((venta - compra) / compra) * 100 : NaN);

/** Campo de pesos con el signo $ delante (la venta va resaltada). */
function Pesos({ value, onChange, error, destacado = false, ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <input
        {...props}
        inputMode="numeric"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} pl-7 tabular-nums ${destacado ? 'font-bold' : ''}`}
      />
    </div>
  );
}

/**
 * "Confirmar precios y emitir" (Pedidos-Cotización).
 *
 * Por cada llanta el asesor registra, en una sola fila: el proveedor, el
 * precio de compra, la ganancia (%) y el precio de VENTA (uno solo). La
 * ganancia y la venta están ligadas: al cambiar una se recalcula la otra
 * sobre el precio de compra (el más alto, si hay varios proveedores). Por
 * defecto la ganancia es la sugerida (20 %).
 *
 * Con varios proveedores se reparte la cantidad (cada uno con su cantidad y
 * su precio de compra) y las cantidades deben sumar la de la llanta. En la
 * orden de compra, cada proveedor será una línea.
 */
export default function EmitirCotizacionModal({ cotizacion: inicial, onEmitida, onClose }) {
  const { documento, cargando, error } = useDetalle({ ...inicial, detalle: undefined }, cotizacionesService);
  const proveedores = useRecurso(proveedoresService);
  const opciones = useMemo(() => opcionesEmpresas(proveedores.filas), [proveedores.filas]);
  const { enviando, errorEnvio, enviar } = useEnvio();
  // Solo se guarda lo que el asesor cambia; lo demás sale de la línea
  const [ediciones, setEdiciones] = useState({});
  const [intento, setIntento] = useState(false);

  // Las llantas reencauchadas tienen precio fijo y no se le compran a nadie: no se confirman aquí
  const llantas = useMemo(
    () => (documento.detalle ?? []).filter((l) => l.tipo === 'producto' && !l.reencauchada),
    [documento.detalle],
  );
  const reencauchadas = useMemo(
    () => (documento.detalle ?? []).filter((l) => l.tipo === 'producto' && l.reencauchada),
    [documento.detalle],
  );
  // Reencauches de la cotización que todavía no tienen precio: sin ellos no se emite
  const serviciosSinPrecio = useMemo(
    () => (documento.detalle ?? []).filter((l) => l.tipo === 'servicio' && !l.solicitudDatos?.precio),
    [documento.detalle],
  );

  /** Un proveedor del reparto, listo para el formulario. */
  const proveedorFila = (proveedorId = '', cantidad = 1, costo = 0) => ({
    proveedorId,
    cantidad,
    compra: formatoMiles(String(costo || '')),
  });

  // Valores de cada línea: lo que escribió el asesor o, si se re-emite, lo que
  // ya tenía (incluido el reparto entre proveedores). Sin valores
  // predeterminados de catálogo: el asesor escribe la compra que le confirmó
  // cada proveedor; la venta se propone con la ganancia sugerida.
  const filas = useMemo(
    () =>
      Object.fromEntries(
        llantas.map((l) => {
          const reparto = l.proveedoresLinea?.length
            ? l.proveedoresLinea.map((p) => proveedorFila(p.proveedorId, p.cantidad, p.costo))
            : [proveedorFila(l.proveedorLineaId ?? inicial.proveedorId ?? '', l.cantidad, l.costoProveedor)];
          // Si se re-emite, la ganancia sale de los precios que ya tenía
          const compraPrevia = Math.max(0, ...reparto.map((p) => aNumero(p.compra)));
          const gananciaPrevia = l.precioUnitarioValor && compraPrevia ? gananciaDe(l.precioUnitarioValor, compraPrevia) : NaN;
          return [
            l.lineaId,
            {
              proveedores: reparto,
              precio: formatoMiles(String(l.precioUnitarioValor || '')),
              ganancia: porcentajeATexto(Number.isFinite(gananciaPrevia) ? gananciaPrevia : GANANCIA_POR_DEFECTO),
              ...ediciones[l.lineaId],
            },
          ];
        }),
      ),
    [llantas, inicial.proveedorId, ediciones],
  );

  const cambiar = (id, cambios) => setEdiciones((e) => ({ ...e, [id]: { ...e[id], ...cambios } }));

  /** Reemplaza el reparto de proveedores de una llanta. */
  const cambiarReparto = (id, proveedoresNuevos) => cambiar(id, { proveedores: proveedoresNuevos });

  /** Cambia un campo de un proveedor del reparto. */
  const cambiarProveedor = (id, idx, cambios) => {
    const actuales = filas[id].proveedores;
    cambiarReparto(id, actuales.map((p, i) => (i === idx ? { ...p, ...cambios } : p)));
  };

  const agregarProveedor = (id) => cambiarReparto(id, [...filas[id].proveedores, proveedorFila()]);
  const quitarProveedor = (id, idx) => cambiarReparto(id, filas[id].proveedores.filter((_, i) => i !== idx));

  /** Precio de compra de referencia de una llanta: el más alto del reparto. */
  const compraDe = (proveedoresLinea) => Math.max(0, ...proveedoresLinea.map((p) => aNumero(p.compra)));

  /**
   * Al escribir un precio de compra: si el asesor fijó la venta a mano, se
   * conserva y se recalcula la ganancia; si no, la venta sale de la ganancia.
   */
  const cambiarCompra = (id, idx, texto) => {
    const f = filas[id];
    const proveedoresNuevos = f.proveedores.map((p, i) => (i === idx ? { ...p, compra: formatoMiles(texto) } : p));
    const compra = compraDe(proveedoresNuevos);
    const cambios = { proveedores: proveedoresNuevos };
    if (f.ventaEditada) {
      cambios.ganancia = porcentajeATexto(gananciaDe(aNumero(f.precio), compra));
    } else {
      const ganancia = aPorcentaje(f.ganancia);
      cambios.precio = compra && Number.isFinite(ganancia) ? formatoMiles(String(ventaCon(compra, ganancia))) : '';
    }
    cambiar(id, cambios);
  };

  /** Al escribir la ganancia (%): la venta se recalcula sobre la compra. */
  const cambiarGanancia = (id, texto) => {
    const limpio = texto.replace(/[^\d,.]/g, '').replace('.', ',').slice(0, 6);
    const compra = compraDe(filas[id].proveedores);
    const ganancia = aPorcentaje(limpio);
    cambiar(id, {
      ganancia: limpio,
      ventaEditada: false,
      ...(compra && Number.isFinite(ganancia) ? { precio: formatoMiles(String(ventaCon(compra, ganancia))) } : {}),
    });
  };

  /** Al escribir la venta: la ganancia se recalcula sobre la compra. */
  const cambiarVenta = (id, texto) => {
    const precio = formatoMiles(texto);
    const compra = compraDe(filas[id].proveedores);
    cambiar(id, { precio, ventaEditada: true, ganancia: compra ? porcentajeATexto(gananciaDe(aNumero(precio), compra)) : filas[id].ganancia });
  };

  /** Errores de una línea (se muestran después del primer intento). */
  const erroresDe = (l) => {
    const f = filas[l.lineaId] ?? {};
    const reparto = f.proveedores ?? [];
    const precio = aNumero(f.precio);
    const maxCompra = Math.max(0, ...reparto.map((p) => aNumero(p.compra)));
    const sumaCantidades = reparto.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
    const e = { proveedores: reparto.map(() => ({})) };
    reparto.forEach((p, i) => {
      if (!p.proveedorId) e.proveedores[i].proveedor = 'Elige el proveedor';
      if (aNumero(p.compra) <= 0) e.proveedores[i].compra = 'Escribe el precio de compra';
      if (reparto.length > 1 && !(Number(p.cantidad) > 0)) e.proveedores[i].cantidad = 'Cantidad';
    });
    // Un mismo proveedor no se repite en el reparto
    const ids = reparto.map((p) => p.proveedorId).filter(Boolean);
    if (new Set(ids).size !== ids.length) e.repartoDuplicado = 'No repitas el mismo proveedor en el reparto.';
    if (reparto.length > 1 && sumaCantidades !== l.cantidad) {
      e.reparto = `Las cantidades por proveedor (${sumaCantidades}) deben sumar ${l.cantidad}.`;
    }
    if (precio <= 0) e.precio = 'Escribe el precio de venta';
    else if (precio < maxCompra) e.precio = 'No puede ser menor que la compra';
    const ganancia = aPorcentaje(f.ganancia);
    if (!Number.isFinite(ganancia)) e.ganancia = 'Escribe la ganancia';
    else if (ganancia > 500) e.ganancia = 'Máximo 500 %';
    return e;
  };

  /** ¿La línea tiene algún error? */
  const lineaInvalida = (l) => {
    const e = erroresDe(l);
    return (
      e.reparto ||
      e.repartoDuplicado ||
      e.precio ||
      e.ganancia ||
      e.proveedores.some((p) => p.proveedor || p.compra || p.cantidad)
    );
  };

  const hayErrores = llantas.some((l) => lineaInvalida(l));
  const subtotal =
    llantas.reduce((s, l) => s + aNumero(filas[l.lineaId]?.precio) * l.cantidad, 0) +
    reencauchadas.reduce((s, l) => s + (l.precioUnitarioValor ?? 0) * l.cantidad, 0);

  const emitir = (cerrar) => {
    setIntento(true);
    if (hayErrores || serviciosSinPrecio.length > 0) return;
    enviar(async () => {
      await cotizacionesService.emitir(
        documento.id,
        llantas.map((l) => {
          const f = filas[l.lineaId];
          const base = { id: l.lineaId, precioUnitario: aNumero(f.precio) };
          // Un solo proveedor: se envían los campos sueltos (como siempre)
          if (f.proveedores.length === 1) {
            return { ...base, proveedorId: f.proveedores[0].proveedorId, costoProveedor: aNumero(f.proveedores[0].compra) };
          }
          // Varios: el reparto, cada uno con su cantidad y su precio de compra
          return {
            ...base,
            proveedores: f.proveedores.map((p) => ({
              proveedorId: p.proveedorId,
              cantidad: Number(p.cantidad),
              costo: aNumero(p.compra),
            })),
          };
        }),
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
            disabled={enviando || cargando || llantas.length + reencauchadas.length === 0 || serviciosSinPrecio.length > 0}
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

        {/* Con reencauche: su precio se define en la revisión antes de emitir */}
        {serviciosSinPrecio.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            <Wrench size={15} className="mt-px shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Esta cotización incluye reencauche sin precio.</p>
              <p className="mt-0.5">
                Asigna el precio de {serviciosSinPrecio.map((l) => l.solicitud).filter(Boolean).join(', ') || 'el servicio'} en{' '}
                <Link to="/admin/reencauches" className="font-semibold underline underline-offset-2">
                  Revisiones
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

        {/* Llantas reencauchadas: unidad única con precio fijo, sin proveedor */}
        {reencauchadas.length > 0 && (
          <ul className="space-y-2">
            {reencauchadas.map((l) => (
              <li
                key={l.lineaId}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {l.nombre} <span className="font-normal text-slate-400">· {l.codigo} · {l.medida}</span>
                </p>
                <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {l.unitario} <span className="text-xs font-normal text-slate-400">· precio fijo, sin compra al proveedor</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <ul className="space-y-3">
          {llantas.map((l) => {
            const f = filas[l.lineaId] ?? {};
            const reparto = f.proveedores ?? [];
            const e = intento ? erroresDe(l) : { proveedores: reparto.map(() => ({})) };
            const varios = reparto.length > 1;
            const subtotalLinea = aNumero(f.precio) * l.cantidad;
            return (
              <li key={l.lineaId} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                {/* ---- La llanta: nombre grande, medida, código, cantidad y subtotal ---- */}
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold leading-tight text-slate-900 dark:text-white">{l.nombre}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{l.medida}</span> · {l.codigo}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{l.cantidad} und.</p>
                    <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCOP(subtotalLinea)}</p>
                  </div>
                </div>
                {l.costoConfirmadoEn && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Precio de compra confirmado antes el {fecha(l.costoConfirmadoEn)}.
                  </p>
                )}

                {/* ---- Todo en una fila: proveedor · compra · ganancia · venta ---- */}
                <div className="mt-3 space-y-2">
                  {reparto.map((p, i) => {
                    const ep = e.proveedores?.[i] ?? {};
                    const primera = i === 0;
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-2 items-start gap-x-3 gap-y-2 ${
                          varios
                            ? 'lg:grid-cols-[minmax(0,2fr)_4.5rem_minmax(0,1fr)_2.75rem_6.5rem_minmax(0,1fr)]'
                            : 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6.5rem_minmax(0,1fr)]'
                        }`}
                      >
                        <div className="col-span-2 lg:col-span-1">
                          {primera && <span className={LABEL}>Proveedor</span>}
                          <SearchSelect
                            value={p.proveedorId}
                            options={opciones}
                            onChange={(id) => cambiarProveedor(l.lineaId, i, { proveedorId: id })}
                            placeholderBusqueda="Razón social o NIT"
                            error={Boolean(ep.proveedor)}
                          />
                          {ep.proveedor && <p className="mt-1 text-xs text-red-500">{ep.proveedor}</p>}
                        </div>

                        {varios && (
                          <div>
                            {primera && <span className={LABEL}>Cant.</span>}
                            <input
                              inputMode="numeric"
                              value={p.cantidad}
                              aria-label={`Cantidad del proveedor ${i + 1}`}
                              onChange={(ev) =>
                                cambiarProveedor(l.lineaId, i, { cantidad: Number(String(ev.target.value).replace(/\D/g, '')) || '' })
                              }
                              className={`${INPUT} ${ep.cantidad ? BORDER_ERR : BORDER_OK} text-center tabular-nums`}
                            />
                          </div>
                        )}

                        <div>
                          {primera && <span className={LABEL}>Compra c/u</span>}
                          <Pesos
                            value={p.compra ?? ''}
                            aria-label={`Precio de compra del proveedor ${i + 1}`}
                            onChange={(texto) => cambiarCompra(l.lineaId, i, texto)}
                            error={ep.compra}
                          />
                          {ep.compra && <p className="mt-1 text-xs text-red-500">{ep.compra}</p>}
                        </div>

                        {varios && (
                          <div className={primera ? 'flex items-end self-stretch' : ''}>
                            <button
                              type="button"
                              onClick={() => quitarProveedor(l.lineaId, i)}
                              aria-label="Quitar este proveedor"
                              className="flex h-[42px] w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}

                        {/* Ganancia y venta: una sola vez por llanta, en la primera fila */}
                        {primera && (
                          <>
                            <div>
                              <label className={LABEL} htmlFor={`ganancia-${l.lineaId}`}>
                                Ganancia
                              </label>
                              <div className="relative">
                                <input
                                  id={`ganancia-${l.lineaId}`}
                                  inputMode="decimal"
                                  value={f.ganancia ?? ''}
                                  onChange={(ev) => cambiarGanancia(l.lineaId, ev.target.value)}
                                  className={`${INPUT} ${e.ganancia ? BORDER_ERR : BORDER_OK} pr-7 text-right tabular-nums`}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                              </div>
                              {e.ganancia && <p className="mt-1 text-xs text-red-500">{e.ganancia}</p>}
                            </div>
                            <div>
                              <label className={LABEL} htmlFor={`precio-${l.lineaId}`}>
                                Venta c/u
                              </label>
                              <Pesos
                                id={`precio-${l.lineaId}`}
                                value={f.precio ?? ''}
                                onChange={(texto) => cambiarVenta(l.lineaId, texto)}
                                error={e.precio}
                                destacado
                              />
                              {e.precio && <p className="mt-1 text-xs text-red-500">{e.precio}</p>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => agregarProveedor(l.lineaId)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    >
                      <Plus size={14} /> Agregar otro proveedor
                    </button>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {varios ? 'La ganancia se calcula sobre la compra más alta · ' : ''}
                      Sugerida: {GANANCIA_POR_DEFECTO} %
                    </p>
                  </div>
                  {e.reparto && <p className="text-xs font-medium text-red-500">{e.reparto}</p>}
                  {e.repartoDuplicado && <p className="text-xs font-medium text-red-500">{e.repartoDuplicado}</p>}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.14] via-amber-400/[0.05] to-transparent px-5 py-3">
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
