import { useMemo, useState } from 'react';
import { Check, FileText, Info, Minus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import FormModal from '../../../components/base/FormModal';
import Badge from '../../../components/base/Badge';
import SearchSelect from '../../../components/base/SearchSelect';
import { BORDER_ERR, BORDER_OK, INPUT as FIELD, LABEL, SECTION, soloDigitos } from '../../../components/base/formStyles';
import { PLAZO_RESPUESTA_HORAS, SERVICIO_POR_DEFECTO } from '../../../constantes';
import { useValidacion } from '../../../hooks/useValidacion';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesService, proveedoresService, serviciosService } from '../../../services';
import { opcionesClientes, opcionesEmpresas } from '../../../utils/opciones';
import { servicioInitialValues, servicioSectionsAdmin } from '../../shared/servicioSections';
import SelectorProductosModal from '../shared/SelectorProductosModal';

/** Cantidad máxima de una línea (la API también la limita). */
const CANTIDAD_MAXIMA = 999;

/**
 * "Nueva cotización" del asesor: registra la SOLICITUD.
 *
 * Solo se eligen el cliente (con buscador por nombre o documento), las
 * llantas con su cantidad y los servicios de reencauche. No lleva fecha (la
 * pone el servidor), precios, método de pago ni stock: los precios se
 * confirman con el proveedor al emitir la cotización formal, y el método de
 * pago se elige cuando el cliente la acepta.
 */
export default function NuevoPedidoModal({ onSubmit, onClose }) {
  const clientes = useRecurso(clientesService);
  const proveedores = useRecurso(proveedoresService);
  const servicios = useRecurso(serviciosService);
  const { enviando, errorEnvio, enviar } = useEnvio();

  const [clienteId, setClienteId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lineas, setLineas] = useState([]);
  const [servicioModal, setServicioModal] = useState(false);
  // Línea de servicio que se está editando (null = ninguna)
  const [servicioEditado, setServicioEditado] = useState(null);
  const [productosModal, setProductosModal] = useState(false);

  const opcionesCliente = useMemo(() => opcionesClientes(clientes.filas), [clientes.filas]);
  const opcionesProveedor = useMemo(() => opcionesEmpresas(proveedores.filas), [proveedores.filas]);

  /** Al elegir el cliente se trae su dirección para el despacho. */
  const elegirCliente = (id) => {
    setClienteId(id);
    const ficha = clientes.filas.find((c) => c.id === id);
    if (ficha && !direccion) setDireccion(ficha.direccion ?? '');
    tocar('cliente');
  };

  /** Una llanta ya agregada suma una unidad en vez de repetir la línea. */
  const agregarProducto = (p) => {
    tocar('lineas');
    setLineas((prev) => {
      const existente = prev.find((l) => l.tipo === 'producto' && l.productoId === p.id);
      if (existente) {
        return prev.map((l) =>
          l.id === existente.id ? { ...l, cantidad: Math.min(CANTIDAD_MAXIMA, l.cantidad + 1) } : l,
        );
      }
      return [
        ...prev,
        {
          // Identificador propio de la línea (solo para la tabla)
          id: crypto.randomUUID(),
          tipo: 'producto',
          productoId: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          medida: p.medidas,
          detalle: `${p.codigo} · ${p.marca} · ${p.medidas}`,
          cantidad: 1,
        },
      ];
    });
  };

  /**
   * Guarda una línea de servicio: nueva, o los cambios de la que se está
   * editando. El valor se asigna después en "Solicitudes de servicio".
   */
  const agregarServicio = (values) => {
    tocar('lineas');
    const nombre = SERVICIO_POR_DEFECTO;
    const ficha = servicios.filas.find((s) => s.nombre === nombre);
    const datos = {
      tipo: 'servicio',
      servicioId: ficha?.id,
      nombre,
      servicio: nombre,
      medida: values.medidas ?? '',
      medidas: values.medidas ?? '',
      detalle: values.descripcion,
      descripcion: values.descripcion,
      estadoEvidencia: values.estadoEvidencia || 'Pendiente de revisión',
      foto: values.foto,
      cantidad: Number(values.cantidad) || 1,
    };
    if (servicioEditado) {
      setLineas((prev) => prev.map((l) => (l.id === servicioEditado.id ? { ...l, ...datos } : l)));
    } else {
      setLineas((prev) => [...prev, { id: crypto.randomUUID(), ...datos }]);
    }
  };

  /** Cantidad entre 1 y 999 (vacía o 0 queda en 1). */
  const setCantidad = (id, cantidad) =>
    setLineas((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, cantidad: Math.min(CANTIDAD_MAXIMA, Math.max(1, Number(cantidad) || 1)) } : l,
      ),
    );

  const quitarLinea = (id) => setLineas((prev) => prev.filter((l) => l.id !== id));

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores: errors, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!clienteId) next.cliente = 'Busca y selecciona el cliente';
    if (!direccion.trim()) next.direccion = 'Indica la dirección de despacho';
    if (lineas.length === 0) next.lineas = 'Agrega al menos una llanta o un servicio';
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;
    enviar(() => onSubmit({ clienteId, proveedorId, direccion, lineas }), close);
  };

  const llantas = lineas.filter((l) => l.tipo === 'producto').length;

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
                  placeholder={clientes.cargando ? 'Cargando clientes…' : 'Buscar cliente…'}
                  placeholderBusqueda="Nombre o número de documento"
                  error={Boolean(errors.cliente)}
                />
                {errors.cliente && <p className="mt-1 text-xs font-medium text-red-500">{errors.cliente}</p>}
              </div>

              <div>
                <label htmlFor="np-proveedor" className={LABEL}>
                  Proveedor sugerido
                </label>
                <SearchSelect
                  id="np-proveedor"
                  value={proveedorId}
                  options={opcionesProveedor}
                  onChange={setProveedorId}
                  placeholder="Opcional: se confirma al emitir"
                  placeholderBusqueda="Razón social o NIT"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="np-direccion" className={LABEL}>
                  Dirección de despacho <span className="text-red-500">*</span>
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
                {errors.direccion && <p className="mt-1 text-xs font-medium text-red-500">{errors.direccion}</p>}
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
              <button
                type="button"
                onClick={() => setServicioModal(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <MoreHorizontal size={14} /> Servicios
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
                  Usa los botones "Llantas" o "Servicios" de arriba para empezar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                {lineas.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                    {l.tipo === 'servicio' && l.foto && (
                      <img src={l.foto} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold tracking-wide text-slate-400 dark:text-slate-500">
                        {l.tipo === 'servicio' ? 'SERVICIO · SE COBRA APARTE' : 'LLANTA'}
                      </p>
                      <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</p>
                      <p className="break-words text-xs text-slate-400 dark:text-slate-500">{l.detalle}</p>
                      {l.tipo === 'servicio' && (
                        <span className="mt-1 inline-block">
                          <Badge>{l.estadoEvidencia}</Badge>
                        </span>
                      )}
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
                        disabled={l.cantidad >= CANTIDAD_MAXIMA}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                        aria-label={`Una unidad más de ${l.nombre}`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center">
                      {l.tipo === 'servicio' && (
                        <button
                          type="button"
                          onClick={() => setServicioEditado(l)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-amber-500"
                          aria-label={`Editar ${l.nombre}`}
                          title="Editar el servicio"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
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
              {llantas > 0
                ? `Queda como solicitud con precios por confirmar (plazo de respuesta: ${PLAZO_RESPUESTA_HORAS} horas). En Pedidos-Cotización usa "Confirmar precios" para registrar el costo del proveedor y el precio de venta, y emitir la cotización formal.`
                : 'Una solicitud de solo reencauche no necesita cotización formal: su valor y su pago se gestionan en "Solicitudes de servicio".'}
            </p>
          </section>
        </div>
      </Modal>

      {(servicioModal || servicioEditado) && (
        <FormModal
          mode={servicioEditado ? 'edit' : 'create'}
          title={servicioEditado ? 'Editar servicio' : 'Agregar servicio'}
          subtitle="Reencauche: sube la foto de la carcasa para evaluar si es apta. El valor se asigna en Solicitudes de servicio."
          sections={servicioSectionsAdmin}
          initialValues={servicioEditado ?? servicioInitialValues}
          submitLabel={servicioEditado ? 'Guardar cambios' : 'Agregar a la solicitud'}
          onSubmit={agregarServicio}
          onClose={() => {
            setServicioModal(false);
            setServicioEditado(null);
          }}
        />
      )}

      {productosModal && <SelectorProductosModal onAgregar={agregarProducto} onClose={() => setProductosModal(false)} />}
    </>
  );
}
