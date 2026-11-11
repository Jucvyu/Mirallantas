import { useMemo, useState } from 'react';
import { Check, FileText, Info, Minus, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import SearchSelect from '../../../components/base/SearchSelect';
import { BORDER_ERR, BORDER_OK, INPUT as FIELD, LABEL, SECTION, soloDigitos } from '../../../components/base/formStyles';
import { PLAZO_RESPUESTA_HORAS } from '../../../constantes';
import { useValidacion } from '../../../hooks/useValidacion';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesSeleccionablesService } from '../../../services';
import { opcionesClientes } from '../../../utils/opciones';
import ResumenCliente from '../../../components/base/ResumenCliente';
import SelectorProductosModal from '../shared/SelectorProductosModal';

/** Cantidad máxima de una línea (la API también la limita). */
const CANTIDAD_MAXIMA = 999;

/**
 * "Nueva cotización" del asesor: registra la SOLICITUD.
 *
 * Solo se eligen el cliente (con buscador por nombre o documento), el
 * lugar de despacho y las llantas con su cantidad. El reencauche ya no va en
 * la cotización: se registra en Reencauche › Revisiones. No lleva fecha (la pone el servidor), precios, proveedor,
 * método de pago ni stock: los precios se verifican con el proveedor al
 * emitir la cotización formal, y el método de pago se elige al aceptarla.
 *
 * El lugar de despacho toma la dirección registrada del cliente elegido y
 * se puede cambiar solo para esta cotización: no modifica la ficha del
 * cliente, y una cotización ya guardada conserva el suyo.
 */
export default function NuevoPedidoModal({ onSubmit, onClose }) {
  const clientes = useRecurso(clientesSeleccionablesService);
  const { enviando, errorEnvio, enviar } = useEnvio();

  const [clienteId, setClienteId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lineas, setLineas] = useState([]);
  const [productosModal, setProductosModal] = useState(false);

  const opcionesCliente = useMemo(() => opcionesClientes(clientes.filas), [clientes.filas]);

  /**
   * Al elegir (o cambiar) el cliente, el lugar de despacho pasa a ser la
   * dirección registrada de ESE cliente: no se queda la del anterior. Si no
   * tiene dirección, el campo queda vacío para escribirlo.
   */
  const elegirCliente = (id) => {
    setClienteId(id);
    const ficha = clientes.filas.find((c) => c.id === id);
    setDireccion(ficha?.direccion ?? '');
    tocar('cliente');
    tocar('direccion');
  };

  /** Agrega las llantas elegidas en el selector; las que ya estén no se repiten. */
  const agregarProductos = (elegidos) => {
    tocar('lineas');
    setLineas((prev) => [
      ...prev,
      ...elegidos
        .filter((p) => !prev.some((l) => l.tipo === 'producto' && l.productoId === p.id))
        .map((p) => ({
          // Identificador propio de la línea (solo para la tabla)
          id: crypto.randomUUID(),
          tipo: 'producto',
          productoId: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          medida: p.medidas,
          detalle: `${p.codigo} · ${p.marca} · Medida ${p.medidas}`,
          // La llanta reencauchada es una sola unidad
          maximo: p.reencauchada ? 1 : CANTIDAD_MAXIMA,
          cantidad: 1,
        })),
    ]);
  };

  /** Cantidad entre 1 y 999 (vacía o 0 queda en 1). */
  const setCantidad = (id, cantidad) =>
    setLineas((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, cantidad: Math.min(l.maximo ?? CANTIDAD_MAXIMA, Math.max(1, Number(cantidad) || 1)) } : l,
      ),
    );

  const quitarLinea = (id) => setLineas((prev) => prev.filter((l) => l.id !== id));

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores: errors, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!clienteId) next.cliente = 'Busca y selecciona el cliente';
    if (!direccion.trim()) next.direccion = 'Indica el lugar de despacho';
    else if (direccion.trim().length > 200) next.direccion = 'Máximo 200 caracteres';
    if (lineas.length === 0) next.lineas = 'Agrega al menos una llanta';
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;
    enviar(() => onSubmit({ clienteId, direccion: direccion.trim(), lineas }), close);
  };

  return (
    <>
      <Modal
        title="Nueva cotización"
        subtitle="Registra la solicitud: cliente, llantas y cantidades. Los precios se confirman al emitirla."
        icon={<FileText size={17} />}
        size="xl"
        onClose={onClose}
        footer={(close) => (
          <>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => guardar(close)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
            >
              <Check size={16} /> {enviando ? 'Guardando…' : 'Registrar solicitud'}
            </button>
          </>
        )}
      >
        <div className="space-y-6">
          <AvisoError mensaje={errorEnvio} />

          {/* ---- Cliente y despacho ---- */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className={SECTION}>Datos de la solicitud</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="np-cliente" className={LABEL}>
                  Cliente <span className="text-red-500">*</span>
                </label>
                <SearchSelect
                  id="np-cliente"
                  value={clienteId}
                  options={opcionesCliente}
                  onChange={elegirCliente}
                  placeholder="Buscar cliente…"
                  placeholderBusqueda="Nombre o número de documento"
                  error={Boolean(errors.cliente)}
                />
                {errors.cliente && <p className="mt-1 text-xs font-medium text-red-500">{errors.cliente}</p>}
                <ResumenCliente cliente={clientes.filas.find((c) => c.id === clienteId)} />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="np-direccion" className={LABEL}>
                  Lugar de despacho <span className="text-red-500">*</span>
                </label>
                <input
                  id="np-direccion"
                  value={direccion}
                  onChange={(e) => {
                    setDireccion(e.target.value);
                    tocar('direccion');
                  }}
                  placeholder="Calle 50 #45-12, Medellín"
                  className={`${FIELD} ${errors.direccion ? BORDER_ERR : BORDER_OK}`}
                />
                {errors.direccion ? (
                  <p className="mt-1 text-xs font-medium text-red-500">{errors.direccion}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Se carga la dirección registrada del cliente; puedes cambiarla solo para esta cotización.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ---- Detalle ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className={SECTION}>Detalle</span>
              <button
                type="button"
                onClick={() => setProductosModal(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <MoreHorizontal size={14} /> Llantas
              </button>
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            {lineas.length === 0 ? (
              <div
                className={`rounded-xl border border-dashed py-10 text-center ${
                  errors.lineas ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">La solicitud todavía no tiene líneas</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
                  Usa el botón "Llantas" de arriba para empezar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                {lineas.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</p>
                      <p className="break-words text-xs text-slate-400 dark:text-slate-500">{l.detalle}</p>
                    </div>

                    {/* Cantidad: campo angosto con botones, de 1 a 999 */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCantidad(l.id, l.cantidad - 1)}
                        disabled={l.cantidad <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        aria-label={`Una unidad menos de ${l.nombre}`}
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        inputMode="numeric"
                        value={l.cantidad}
                        onChange={(e) => setCantidad(l.id, soloDigitos(e.target.value))}
                        aria-label={`Cantidad de ${l.nombre}`}
                        className={`${FIELD} ${BORDER_OK} !w-14 !px-1 !py-1.5 text-center`}
                      />
                      <button
                        type="button"
                        onClick={() => setCantidad(l.id, l.cantidad + 1)}
                        disabled={l.cantidad >= (l.maximo ?? CANTIDAD_MAXIMA)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        aria-label={`Una unidad más de ${l.nombre}`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => quitarLinea(l.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                        aria-label={`Quitar ${l.nombre}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {errors.lineas && <p className="mt-2 text-xs font-medium text-red-500">{errors.lineas}</p>}

            {/* ---- Qué sigue ---- */}
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <Info size={15} className="mt-px shrink-0 text-amber-500" />
              {`Queda como solicitud con precios por confirmar (plazo de respuesta: ${PLAZO_RESPUESTA_HORAS} horas). En Pedidos-Cotización usa "Confirmar precios" para registrar el costo del proveedor y el precio de venta, y emitir la cotización formal. El reencauche se registra aparte, en Reencauche › Revisiones.`}
            </p>
          </section>
        </div>
      </Modal>

      {productosModal && (
        <SelectorProductosModal
          yaAgregados={lineas.filter((l) => l.tipo === 'producto').map((l) => l.productoId)}
          onAgregar={agregarProductos}
          onClose={() => setProductosModal(false)}
        />
      )}
    </>
  );
}
