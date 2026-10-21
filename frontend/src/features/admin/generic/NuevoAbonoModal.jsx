import { useEffect, useMemo, useRef, useState } from 'react';
import SearchSelect from '../../../components/base/SearchSelect';
import { useRecurso } from '../../../hooks/useRecurso';
import { abonosService, clientesService, nuevaClaveIdempotencia } from '../../../services';
import { opcionesClientes } from '../../../utils/opciones';
import { leerImagen, TIPOS_IMAGEN } from '../../../utils/imagenes';
import { Check, ChevronDown, ImagePlus, Wallet, X } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import Modal from '../../../components/base/Modal';
import {
  BORDER_ERR as BORDE_ERR,
  BORDER_OK as BORDE_OK,
  INPUT as CAMPO,
  LABEL,
  SECTION,
  formatoMiles,
} from '../../../components/base/formStyles';
import { mediosPago } from '../../../constantes';
import { useValidacion } from '../../../hooks/useValidacion';
import { useEnvio } from '../../../hooks/useEnvio';
import { formatCOP, parseCOP } from '../../../utils/formato';
import Skeleton from '../../../components/base/Skeleton';

/**
 * "Nuevo abono" del administrador: un pago sobre una FACTURA.
 *
 * La factura es la venta a crédito (VEN-…): su crédito guarda el saldo. Se
 * busca primero el cliente y luego su factura, entre las que de verdad
 * admiten pagos (no anuladas, con crédito activo y saldo). Si el modal se
 * abre desde un crédito (`creditoFijo`), la factura es la de ese crédito.
 *
 * Al guardar, la API registra el abono como confirmado y resta el saldo en
 * la misma operación (si algo falla, no queda ninguno de los dos). El monto
 * no puede superar el saldo; el pantallazo es obligatorio en transferencia.
 */
export default function NuevoAbonoModal({ creditoFijo = null, onSubmit, onClose }) {
  // Una clave por formulario abierto: si el envío se repite, no se duplica el abono
  const [claveIdempotencia] = useState(nuevaClaveIdempotencia);
  const clientes = useRecurso(clientesService);
  const opcionesCliente = useMemo(() => opcionesClientes(clientes.filas), [clientes.filas]);
  const [clienteId, setClienteId] = useState(creditoFijo?.clienteId ?? '');
  const [facturas, setFacturas] = useState([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(Boolean(creditoFijo?.clienteId));
  const [errorFacturas, setErrorFacturas] = useState('');
  const [facturaNumero, setFacturaNumero] = useState(creditoFijo?.venta || '');
  const [comprobante, setComprobante] = useState('');
  const archivo = useRef(null);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('');
  const [errorArchivo, setErrorArchivo] = useState('');
  // Se avisa cuando el monto se recortó solo por superar el saldo
  const [recortado, setRecortado] = useState(false);
  const { enviando, errorEnvio, enviar } = useEnvio();

  // Facturas del cliente elegido (se vuelven a pedir si cambia el cliente)
  useEffect(() => {
    if (!clienteId) return undefined;
    let vigente = true;
    abonosService
      .facturas(clienteId)
      .then((filas) => vigente && setFacturas(filas))
      .catch((e) => vigente && setErrorFacturas(e.message))
      .finally(() => vigente && setCargandoFacturas(false));
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const factura = facturas.find((f) => f.numero === facturaNumero) ?? null;
  const opcionesFactura = useMemo(
    () =>
      facturas.map((f) => ({
        valor: f.numero,
        etiqueta: `${f.numero} · ${f.cliente}`,
        detalle: `Saldo ${formatCOP(f.saldoPendiente)} · ${f.fecha} · Crédito ${f.credito}`,
      })),
    [facturas],
  );

  const valor = parseCOP(monto);
  const saldoActual = factura ? factura.saldoPendiente : 0;
  const saldoNuevo = Math.max(0, saldoActual - valor);

  // El pantallazo solo tiene sentido en transferencia: el efectivo se paga
  // en el local y la tarjeta deja su propio recibo.
  const requiereComprobante = metodo === 'Transferencia';

  const cargarComprobante = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    leerImagen(file)
      .then((dataUrl) => {
        setComprobante(dataUrl);
        setErrorArchivo('');
        tocar('comprobante');
      })
      .catch((error) => {
        setErrorArchivo(error.message);
        tocar('comprobante');
      });
  };

  /**
   * Nadie puede abonar más de lo que debe: si el asesor escribe un valor
   * mayor al saldo del crédito, el campo se ajusta solo al saldo total.
   */
  const escribirMonto = (texto) => {
    const limpio = formatoMiles(texto);
    if (factura && parseCOP(limpio) > saldoActual) {
      setMonto(formatoMiles(String(saldoActual)));
      setRecortado(true);
    } else {
      setMonto(limpio);
      setRecortado(false);
    }
    tocar('monto');
  };

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!clienteId) next.cliente = 'Busca y selecciona el cliente';
    if (!factura) next.factura = 'Selecciona la factura que se está pagando';
    if (!valor) next.monto = 'Indica el monto pagado';
    if (!metodo) next.metodo = 'Selecciona el método de pago';
    if (requiereComprobante && !comprobante) next.comprobante = 'Adjunta el comprobante del pago';
    if (errorArchivo) next.comprobante = errorArchivo;
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;

    // POST /api/abonos con la factura; la fecha la pone el servidor
    const datos = {
      factura: factura.numero,
      monto: valor,
      medioPago: metodo,
      comprobante: requiereComprobante ? comprobante : null,
      claveIdempotencia,
    };
    enviar(() => onSubmit(datos), close);
  };

  return (
    <Modal
      title="Nuevo abono"
      subtitle="Registra un pago sobre una factura (venta a crédito) con saldo."
      icon={<Wallet size={17} />}
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
            disabled={enviando || !factura}
            onClick={() => guardar(close)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            <Check size={16} /> {enviando ? 'Guardando…' : 'Guardar abono'}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={errorEnvio} />

        {/* ---- Factura que se paga ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Factura</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          {creditoFijo && !creditoFijo.venta ? (
            // Un crédito aprobado tiene factura cuando su pedido se completa
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-300">
              Este crédito todavía no tiene factura: la venta se genera cuando su cotización se completa. Hasta
              entonces, el cliente puede subir sus abonos desde el portal.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ab-cliente" className={LABEL}>
                  Cliente <span className="text-red-500">*</span>
                </label>
                {creditoFijo ? (
                  <div className={`${CAMPO} ${BORDE_OK}`}>{creditoFijo.cliente}</div>
                ) : (
                  <SearchSelect
                    id="ab-cliente"
                    value={clienteId}
                    options={opcionesCliente}
                    onChange={(id) => {
                      // Otra persona: la factura elegida ya no aplica
                      setClienteId(id);
                      setFacturaNumero('');
                      setFacturas([]);
                      setErrorFacturas('');
                      setCargandoFacturas(true);
                      tocar('cliente');
                    }}
                    placeholder="Buscar cliente…"
                    placeholderBusqueda="Nombre o número de documento"
                    error={Boolean(errores.cliente)}
                  />
                )}
                {errores.cliente && <p className="mt-1 text-xs font-medium text-red-500">{errores.cliente}</p>}
              </div>

              <div>
                <label htmlFor="ab-factura" className={LABEL}>
                  Factura <span className="text-red-500">*</span>
                </label>
                {cargandoFacturas ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : creditoFijo ? (
                  <div className={`${CAMPO} ${BORDE_OK}`}>{creditoFijo.venta}</div>
                ) : (
                  <SearchSelect
                    id="ab-factura"
                    value={facturaNumero}
                    options={opcionesFactura}
                    onChange={(numero) => {
                      setFacturaNumero(numero);
                      const elegida = facturas.find((f) => f.numero === numero);
                      // El monto escrito antes puede no caber en el saldo de esta factura
                      if (elegida && parseCOP(monto) > elegida.saldoPendiente) {
                        setMonto(formatoMiles(String(elegida.saldoPendiente)));
                        setRecortado(true);
                      }
                      tocar('factura');
                    }}
                    placeholder={clienteId ? 'Buscar factura…' : 'Primero elige el cliente'}
                    placeholderBusqueda="Número de la venta (VEN-…)"
                    error={Boolean(errores.factura)}
                  />
                )}
                {errorFacturas ? (
                  <p className="mt-1 text-xs font-medium text-red-500">{errorFacturas}</p>
                ) : errores.factura ? (
                  <p className="mt-1 text-xs font-medium text-red-500">{errores.factura}</p>
                ) : (
                  clienteId &&
                  !cargandoFacturas &&
                  facturas.length === 0 && (
                    <p className="mt-1 text-xs text-slate-400">Este cliente no tiene facturas con saldo pendiente.</p>
                  )
                )}
              </div>
            </div>
          )}
        </section>

        {/* ---- Pago ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Pago</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ab-monto" className={LABEL}>
                Monto pagado (COP) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  id="ab-monto"
                  inputMode="numeric"
                  value={monto}
                  onChange={(e) => escribirMonto(e.target.value)}
                  placeholder="2.000.000"
                  className={`${CAMPO} ${errores.monto ? BORDE_ERR : BORDE_OK} pl-8`}
                />
              </div>
              {errores.monto ? (
                <p className="mt-1 text-xs font-medium text-red-500">{errores.monto}</p>
              ) : (
                recortado && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    El abono no puede superar el saldo: se ajustó al total pendiente.
                  </p>
                )
              )}
            </div>

            <div>
              <label htmlFor="ab-metodo" className={LABEL}>
                Método de pago <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="ab-metodo"
                  value={metodo}
                  onChange={(e) => {
                    setMetodo(e.target.value);
                    tocar('metodo');
                  }}
                  className={`${CAMPO} ${errores.metodo ? BORDE_ERR : BORDE_OK} cursor-pointer appearance-none pr-10`}
                >
                  <option value="">Seleccionar...</option>
                  {mediosPago.map((m) => (
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
              {errores.metodo && <p className="mt-1 text-xs font-medium text-red-500">{errores.metodo}</p>}
            </div>
          </div>

          {/* ---- Comprobante de pago ---- */}
          {requiereComprobante && (
            <div className="mt-4">
              <span className={LABEL}>
                Comprobante de pago <span className="text-red-500">*</span>
              </span>
              {comprobante ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                  <img src={comprobante} alt="Comprobante" className="h-40 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setComprobante('')}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                    aria-label="Quitar el comprobante"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => archivo.current?.click()}
                  className={`flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-slate-400 hover:border-amber-400 hover:text-amber-500 ${
                    errores.comprobante ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <ImagePlus size={24} strokeWidth={1.5} />
                  <span className="text-xs font-medium">Sube el pantallazo de la consignación</span>
                </button>
              )}
              <input ref={archivo} type="file" accept={TIPOS_IMAGEN} className="hidden" onChange={cargarComprobante} />
              {errores.comprobante ? (
                <p className="mt-1 text-xs font-medium text-red-500">{errores.comprobante}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Hay que validarlo antes de confirmar el abono.
                </p>
              )}
            </div>
          )}

          {/* El saldo no se captura: se muestra ya calculado */}
          {factura && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Saldo actual
                </p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCOP(saldoActual)}</p>
              </div>
              <ChevronDown size={16} className="-rotate-90 text-slate-300 dark:text-slate-600" />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Saldo tras el abono
                </p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCOP(saldoNuevo)}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
