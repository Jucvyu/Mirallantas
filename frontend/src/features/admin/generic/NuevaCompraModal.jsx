import { useMemo, useState } from 'react';
import { Check, ChevronDown, FileText, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import {
  BORDER_ERR as BORDE_ERR,
  BORDER_OK as BORDE_OK,
  INPUT as CAMPO,
  LABEL,
  SECTION,
  formatoMiles,
  soloDigitos,
} from '../../../components/base/formStyles';
import { useValidacion } from '../../../hooks/useValidacion';
import { useEnvio } from '../../../hooks/useEnvio';
import { useRecurso } from '../../../hooks/useRecurso';
import { comprasService, productosService, proveedoresService } from '../../../services';
import { formatCOP as pesos, parseCOP } from '../../../utils/formato';
import SelectorCotizaciones from '../shared/SelectorCotizaciones';

/**
 * Cotizaciones que se pueden abastecer. Es la regla que ya tenía el
 * sistema; la API la vuelve a comprobar al guardar.
 */
const esAbastecible = (c) => c.estado === 'Aprobada' || c.estado === 'En proceso';

/**
 * "Nueva compra" (orden de compra al proveedor).
 *
 * La cotización de origen se elige de un listado con buscador y filtros.
 * Al elegirla, sus líneas de producto pasan directamente al detalle de la
 * compra —que es lo que hay que abastecer— y el asesor puede sumar los
 * productos extra que quiera pedirle al mismo proveedor. Cada línea guarda
 * cantidad y precio de compra, igual que `detalle_compra`: el precio se
 * propone con el último conocido del producto y el asesor lo ajusta al que
 * acordó con el proveedor. La fecha es la de hoy y la compra nace
 * pendiente, con la entrega también pendiente.
 */
export default function NuevaCompraModal({ onSubmit, onClose }) {
  const productos = useRecurso(productosService);
  const proveedores = useRecurso(proveedoresService);
  const { enviando, errorEnvio, setErrorEnvio, enviar } = useEnvio();

  const [proveedor, setProveedor] = useState('');
  const [cotizacion, setCotizacion] = useState('');
  const [lineas, setLineas] = useState([]);
  const [query, setQuery] = useState('');

  const catalogo = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activos = productos.filas.filter((p) => p.activo);
    if (!q) return activos;
    return activos.filter((p) => `${p.codigo} ${p.nombre} ${p.marca} ${p.medidas}`.toLowerCase().includes(q));
  }, [query, productos.filas]);

  const total = lineas.reduce((suma, l) => suma + l.cantidad * l.precioCompra, 0);
  const deCotizacion = lineas.filter((l) => l.deCotizacion).length;

  /**
   * Al elegir la cotización, el servicio de compras trae sus productos ya
   * convertidos en líneas de compra (marcadas como "de la cotización", con
   * el último precio de compra conocido). Los servicios no se compran: los
   * ejecuta un tercero.
   */
  const elegirCotizacion = async (c) => {
    setCotizacion(c.id);
    tocar('lineas');
    try {
      setLineas(await comprasService.lineasDeCotizacion(c.id, productos.filas));
    } catch (error) {
      setErrorEnvio(error.message);
    }
  };

  const agregar = (p) => {
    tocar('lineas');
    setLineas((prev) => {
      const existente = prev.find((l) => l.id === p.id);
      if (existente) {
        return prev.map((l) => (l.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [...prev, { id: p.id, nombre: p.nombre, medidas: p.medidas, precioCompra: p.precioCompra ?? 0, cantidad: 1 }];
    });
  };

  const setCantidad = (id, cantidad) =>
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, cantidad: Math.max(1, Number(cantidad) || 1) } : l)),
    );

  /** El precio de compra de cada línea es el acordado en esta compra. */
  const setPrecio = (id, texto) =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, precioCompra: parseCOP(texto) } : l)));

  const quitar = (id) => setLineas((prev) => prev.filter((l) => l.id !== id));

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!proveedor) next.proveedor = 'Selecciona el proveedor';
    if (lineas.length === 0) next.lineas = 'Agrega al menos un producto a la compra';
    else if (lineas.some((l) => !l.precioCompra)) next.lineas = 'Indica el precio de compra de cada producto';
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;

    // El servicio de compras arma lo que pide la API; el total lo calcula el servidor
    enviar(() => onSubmit({ proveedor, cotizacion, lineas }, { proveedores: proveedores.filas }), close);
  };

  return (
    <Modal
      title="Nueva compra"
      subtitle="Abastece una cotización aprobada con los productos de un proveedor."
      icon={<ShoppingCart size={17} />}
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
            <Check size={16} /> {enviando ? 'Guardando…' : 'Guardar compra'}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={errorEnvio} />

        {/* ---- Cotización de origen ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Cotización de origen</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>
          <SelectorCotizaciones
            value={cotizacion}
            filtro={esAbastecible}
            vacioLabel="No hay cotizaciones aprobadas por abastecer."
            onChange={elegirCotizacion}
          />
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Al elegirla, sus productos pasan al detalle de la compra; las cantidades deben coincidir.
          </p>
        </section>

        {/* ---- Proveedor ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Proveedor</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="sm:w-1/2">
            <label htmlFor="co-proveedor" className={LABEL}>
              Proveedor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="co-proveedor"
                value={proveedor}
                onChange={(e) => {
                  setProveedor(e.target.value);
                  tocar('proveedor');
                }}
                className={`${CAMPO} ${errores.proveedor ? BORDE_ERR : BORDE_OK} cursor-pointer appearance-none pr-10`}
              >
                <option value="">Seleccionar...</option>
                {/* Un proveedor inactivo no puede recibir órdenes nuevas */}
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
            {errores.proveedor && <p className="mt-1 text-xs font-medium text-red-500">{errores.proveedor}</p>}
          </div>
        </section>

        {/* ---- Productos del catálogo ---- */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className={SECTION}>Productos</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <div className="relative w-full sm:w-56">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto..."
                className={`${CAMPO} ${BORDE_OK} py-2 pl-9`}
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-brand-navy-900">
                <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-right">Último precio</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {catalogo.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{p.nombre}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {p.codigo} · {p.medidas}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {p.precioCompra ? pesos(p.precioCompra) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => agregar(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-300"
                      >
                        <Plus size={13} /> Agregar
                      </button>
                    </td>
                  </tr>
                ))}
                {catalogo.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                      Ningún producto coincide con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Detalle de la compra ---- */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className={SECTION}>Detalle de la compra</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            {deCotizacion > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-400/15 px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <FileText size={12} /> {deCotizacion} de la cotización
              </span>
            )}
          </div>

          {lineas.length === 0 ? (
            <div
              className={`rounded-xl border border-dashed py-10 text-center ${
                errores.lineas ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                La compra todavía no tiene líneas
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
                Elige una cotización para traer sus productos, o agrégalos del catálogo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-brand-navy-900">
                  <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <th className="px-4 py-2.5">Producto</th>
                    <th className="px-4 py-2.5 text-center">Cantidad</th>
                    <th className="px-4 py-2.5 text-right">Precio compra</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 text-slate-600 dark:border-white/5 dark:text-slate-300">
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                          {l.nombre}
                          {l.deCotizacion ? (
                            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              Cotización
                            </span>
                          ) : (
                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              Adicional
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{l.medidas}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          inputMode="numeric"
                          value={l.cantidad}
                          onChange={(e) => setCantidad(l.id, soloDigitos(e.target.value))}
                          aria-label={`Cantidad de ${l.nombre}`}
                          className={`${CAMPO} ${BORDE_OK} w-16 px-2 py-1.5 text-center`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          inputMode="numeric"
                          value={l.precioCompra ? formatoMiles(String(l.precioCompra)) : ''}
                          onChange={(e) => setPrecio(l.id, e.target.value)}
                          placeholder="0"
                          aria-label={`Precio de compra de ${l.nombre}`}
                          className={`${CAMPO} ${l.precioCompra ? BORDE_OK : BORDE_ERR} w-28 px-2 py-1.5 text-right`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
                        {pesos(l.cantidad * l.precioCompra)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => quitar(l.id)}
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

          {errores.lineas && <p className="mt-2 text-xs font-medium text-red-500">{errores.lineas}</p>}

          <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-3">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Total de la compra
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{pesos(total)}</span>
          </div>
        </section>
      </div>
    </Modal>
  );
}
