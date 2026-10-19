import { useState } from 'react';
import { Check, ChevronDown, FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import FormModal from '../../../components/base/FormModal';
import Badge from '../../../components/base/Badge';
import {
  BORDER_ERR,
  BORDER_OK,
  INPUT as FIELD,
  LABEL,
  SECTION,
  formatoMiles,
  soloDigitos,
} from '../../../components/base/formStyles';
import {
  CUOTA_INICIAL_CREDITO,
  INTERES_POR_PLAZO,
  metodosPago,
  PLAZOS_CREDITO,
  SERVICIO_POR_DEFECTO,
} from '../../../constantes';
import { useValidacion } from '../../../hooks/useValidacion';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { clientesService, proveedoresService, serviciosService } from '../../../services';
import { hoyISO } from '../../../utils/formato';
import { servicioInitialValues, servicioSectionsAdmin } from '../../shared/servicioSections';
import { CamposPago, pideComprobante } from '../../shared/PagoConsignacion';
import SelectorProductosModal from '../shared/SelectorProductosModal';

const pesos = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

/**
 * "Nueva cotización-pedido" del administrador.
 *
 * El asesor arma el detalle desde los botones "Productos" y "Servicios"
 * del propio detalle: el primero trae el catálogo completo con precio de
 * venta, el segundo usa el mismo formulario de servicio que el cliente. Si
 * el pago se pacta a crédito, el sistema calcula el interés según el plazo
 * y la cuota inicial del 50% que exige la empresa.
 *
 * Los totales que se ven aquí son una vista previa: al guardar, la API
 * vuelve a tomar los precios del catálogo y recalcula todo.
 */
export default function NuevoPedidoModal({ onSubmit, onClose }) {
  // Listas para los selects (las entregan los servicios)
  const clientes = useRecurso(clientesService);
  const proveedores = useRecurso(proveedoresService);
  const servicios = useRecurso(serviciosService);
  const { enviando, errorEnvio, enviar } = useEnvio();

  const [cliente, setCliente] = useState('');
  const [fecha, setFecha] = useState(hoyISO);
  const [metodoPago, setMetodoPago] = useState('Contado');
  // Pago de contado: medio y consignación ({ medioPago, comprobante })
  const [pagoContado, setPagoContado] = useState({ medioPago: '', comprobante: '' });
  const [plazo, setPlazo] = useState(30);
  const [direccion, setDireccion] = useState('');
  const [proveedor, setProveedor] = useState('');
  // Cuota inicial escrita a mano; vacía significa "el 50% de rigor"
  const [inicialManual, setInicialManual] = useState('');

  const [lineas, setLineas] = useState([]);
  const [servicioModal, setServicioModal] = useState(false);
  // Línea de servicio que se está editando (null = ninguna)
  const [servicioEditado, setServicioEditado] = useState(null);
  // Todos los productos del sistema, con los filtros del catálogo
  const [productosModal, setProductosModal] = useState(false);

  // ---- Totales: subtotal de las líneas, interés y cuota inicial --------
  const subtotal = lineas.reduce((suma, l) => suma + l.cantidad * l.unitario, 0);
  const esCredito = metodoPago === 'Crédito';
  // Se redondea igual que el servidor, para que la vista previa coincida
  const interes = esCredito ? Math.round(subtotal * (INTERES_POR_PLAZO[plazo] ?? 0)) : 0;
  const total = subtotal + interes;
  const inicialMinima = esCredito ? Math.round(total * CUOTA_INICIAL_CREDITO) : 0;
  const inicialEscrita = Number(String(inicialManual).replace(/\D/g, '')) || 0;
  const cuotaInicial = inicialManual === '' ? inicialMinima : inicialEscrita;
  // La empresa no acepta una primera cuota por debajo de la mitad del total
  const inicialInsuficiente = esCredito && total > 0 && cuotaInicial < inicialMinima;

  /** Al elegir el cliente se trae su dirección para el despacho. */
  const elegirCliente = (nombre) => {
    setCliente(nombre);
    const ficha = clientes.filas.find((c) => c.nombreCompleto === nombre);
    if (ficha && !direccion) setDireccion(ficha.direccion ?? '');
    tocar('cliente');
  };

  const agregarProducto = (p) => {
    tocar('lineas');
    setLineas((prev) => {
      const existente = prev.find((l) => l.tipo === 'producto' && l.productoId === p.id);
      if (existente) {
        return prev.map((l) => (l.id === existente.id ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [
        ...prev,
        {
          // Identificador propio de la línea (solo para la tabla)
          id: crypto.randomUUID(),
          tipo: 'producto',
          productoId: p.id,
          nombre: p.nombre,
          medida: p.medidas,
          detalle: `${p.marca} · ${p.medidas}`,
          unitario: p.precioVenta,
          cantidad: 1,
        },
      ];
    });
  };

  /**
   * Guarda una línea de servicio: nueva, o los cambios de la que se está
   * editando. No suma al total: el valor se asigna después en "Solicitudes
   * de servicio" y el cliente lo paga aparte.
   */
  const agregarServicio = (values) => {
    tocar('lineas');
    // Hay un solo servicio: Reencauche
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
      unitario: 0,
      cantidad: Number(values.cantidad) || 1,
    };
    if (servicioEditado) {
      setLineas((prev) => prev.map((l) => (l.id === servicioEditado.id ? { ...l, ...datos } : l)));
    } else {
      // Identificador propio de la línea (solo para la tabla)
      setLineas((prev) => [...prev, { id: crypto.randomUUID(), ...datos }]);
    }
  };

  const setCantidad = (id, cantidad) =>
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, cantidad: Math.max(1, Number(cantidad) || 1) } : l)),
    );

  const quitarLinea = (id) => setLineas((prev) => prev.filter((l) => l.id !== id));

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores: errors, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!cliente) next.cliente = 'Selecciona el cliente';
    if (!direccion.trim()) next.direccion = 'Indica la dirección de despacho';
    if (lineas.length === 0) next.lineas = 'Agrega al menos un producto o servicio a la cotización';
    if (inicialInsuficiente) {
      next.inicial = `La primera cuota debe ser de al menos ${pesos(inicialMinima)} (50% del total).`;
    }
    // De contado (con productos que cobrar): cómo se paga y la consignación
    if (!esCredito && total > 0) {
      if (!pagoContado.medioPago) next.medioPago = 'Elige cómo se va a pagar';
      else if (pideComprobante(pagoContado.medioPago) && !pagoContado.comprobante) {
        next.comprobante = 'Sube la consignación del pago';
      }
    }
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;

    // Se entregan los datos del formulario y las listas para convertir los
    // nombres en ids; el servicio de cotizaciones arma lo que pide la API.
    const pago = !esCredito && total > 0 ? pagoContado : null;
    const datos = { cliente, proveedor, fecha, metodoPago, plazo, direccion, lineas, cuotaInicial, pago };
    enviar(() => onSubmit(datos, { clientes: clientes.filas, proveedores: proveedores.filas }), close);
  };

  return (
    <>
      <Modal
        title="Nueva cotización-pedido"
        subtitle="Arma el detalle desde los botones de productos y servicios."
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
              <Check size={16} /> {enviando ? 'Guardando…' : 'Guardar cotización'}
            </button>
          </>
        )}
      >
        <div className="space-y-6">
          <AvisoError mensaje={errorEnvio} />

          {/* ---- Cabecera de la cotización ---- */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className={SECTION}>Datos de la cotización</span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="np-cliente" className={LABEL}>
                  Cliente <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="np-cliente"
                    value={cliente}
                    onChange={(e) => elegirCliente(e.target.value)}
                    className={`${FIELD} ${errors.cliente ? BORDER_ERR : BORDER_OK} cursor-pointer appearance-none pr-10`}
                  >
                    <option value="">Seleccionar...</option>
                    {clientes.filas
                      .filter((c) => c.activo)
                      .map((c) => (
                        <option key={c.id} value={c.nombreCompleto}>
                          {c.nombreCompleto}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
                {errors.cliente && <p className="mt-1 text-xs font-medium text-red-500">{errors.cliente}</p>}
              </div>

              <div>
                <label htmlFor="np-proveedor" className={LABEL}>
                  Proveedor
                </label>
                <div className="relative">
                  <select
                    id="np-proveedor"
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    className={`${FIELD} ${BORDER_OK} cursor-pointer appearance-none pr-10`}
                  >
                    <option value="">Seleccionar...</option>
                    {/* Un proveedor inactivo ya no surte cotizaciones nuevas */}
                    {proveedores.filas
                      .filter((p) => p.activo)
                      .map((p) => (
                        <option key={p.id} value={p.nombreRazonSocial}>
                          {p.nombreRazonSocial}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="np-fecha" className={LABEL}>
                  Fecha
                </label>
                <input
                  id="np-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={`${FIELD} ${BORDER_OK}`}
                />
              </div>

              <div>
                <label htmlFor="np-pago" className={LABEL}>
                  Método de pago
                </label>
                <div className="relative">
                  <select
                    id="np-pago"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className={`${FIELD} ${BORDER_OK} cursor-pointer appearance-none pr-10`}
                  >
                    {metodosPago.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
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

            {/* De contado: cómo se paga y la consignación */}
            {!esCredito && total > 0 && (
              <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
                <CamposPago
                  pago={pagoContado}
                  errores={{ medioPago: errors.medioPago, comprobante: errors.comprobante }}
                  onCambio={(pago) => {
                    setPagoContado(pago);
                    tocar('medioPago');
                    tocar('comprobante');
                  }}
                />
                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  La cotización sigue su proceso cuando se confirme la consignación.
                </p>
              </div>
            )}

            {/* Plazo: solo tiene sentido cuando se financia */}
            {esCredito && (
              <div className="mt-4">
                <span className={LABEL}>Plazo del crédito</span>
                <div className="flex gap-2">
                  {PLAZOS_CREDITO.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlazo(p)}
                      aria-pressed={plazo === p}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        plazo === p
                          ? 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
                      }`}
                    >
                      {p} días · {(INTERES_POR_PLAZO[p] * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>

                <div className="mt-4 sm:w-1/2">
                  <label htmlFor="np-inicial" className={LABEL}>
                    Primera cuota (COP)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      id="np-inicial"
                      inputMode="numeric"
                      value={inicialManual === '' ? formatoMiles(String(inicialMinima)) : inicialManual}
                      onChange={(e) => {
                        setInicialManual(formatoMiles(e.target.value));
                        tocar('inicial');
                      }}
                      className={`${FIELD} ${
                        inicialInsuficiente || errors.inicial ? BORDER_ERR : BORDER_OK
                      } pl-8`}
                    />
                  </div>
                  {inicialInsuficiente || errors.inicial ? (
                    <p className="mt-1 text-xs font-medium text-red-500">
                      La primera cuota debe ser de al menos {pesos(inicialMinima)} (50% del total).
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Mínimo {pesos(inicialMinima)}, el 50% que exige la empresa.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ---- Detalle de la cotización ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className={SECTION}>Detalle de la cotización</span>
              <button
                type="button"
                onClick={() => setProductosModal(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <MoreHorizontal size={14} /> Productos
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
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  La cotización todavía no tiene líneas
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
                  Usa los botones "Productos" o "Servicios" de arriba para empezar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-brand-navy-900">
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      <th className="px-4 py-2.5">Línea</th>
                      <th className="px-4 py-2.5 text-center">Cantidad</th>
                      <th className="px-4 py-2.5 text-right">Subtotal</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            {l.tipo === 'servicio' && l.foto && (
                              <img src={l.foto} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-wide text-slate-400 dark:text-slate-500">
                                {l.tipo === 'servicio' ? 'SERVICIO' : 'PRODUCTO'}
                              </p>
                              <p className="font-semibold text-slate-800 dark:text-slate-100">{l.nombre}</p>
                              <p className="line-clamp-1 text-xs text-slate-400 dark:text-slate-500">{l.detalle}</p>
                              {l.tipo === 'servicio' && (
                                <span className="mt-1 inline-block">
                                  <Badge>{l.estadoEvidencia}</Badge>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            inputMode="numeric"
                            value={l.cantidad}
                            onChange={(e) => setCantidad(l.id, soloDigitos(e.target.value))}
                            aria-label={`Cantidad de ${l.nombre}`}
                            className={`${FIELD} ${BORDER_OK} w-16 px-2 py-1.5 text-center`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
                          {l.tipo === 'servicio' ? (
                            <span className="text-xs font-medium text-slate-400">Por definir</span>
                          ) : (
                            pesos(l.unitario * l.cantidad)
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {errors.lineas && <p className="mt-2 text-xs font-medium text-red-500">{errors.lineas}</p>}

            {/* ---- Resumen de valores ---- */}
            <dl className="mt-3 space-y-1.5 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4 text-sm">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <dt>Subtotal</dt>
                <dd className="font-semibold">{pesos(subtotal)}</dd>
              </div>
              {esCredito && (
                <>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <dt>Interés ({(INTERES_POR_PLAZO[plazo] * 100).toFixed(0)}% a {plazo} días)</dt>
                    <dd className="font-semibold">{pesos(interes)}</dd>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <dt>Primera cuota</dt>
                    <dd className="font-semibold">{pesos(cuotaInicial)}</dd>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between border-t border-amber-400/40 pt-2">
                <dt className="font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Total</dt>
                <dd className="text-xl font-bold text-slate-900 dark:text-white">{pesos(total)}</dd>
              </div>
            </dl>
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
          submitLabel={servicioEditado ? 'Guardar cambios' : 'Agregar a la cotización'}
          onSubmit={agregarServicio}
          onClose={() => {
            setServicioModal(false);
            setServicioEditado(null);
          }}
        />
      )}

      {productosModal && (
        <SelectorProductosModal onAgregar={agregarProducto} onClose={() => setProductosModal(false)} />
      )}
    </>
  );
}
