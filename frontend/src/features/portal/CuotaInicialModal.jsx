import { useRef, useState } from 'react';
import { Check, ChevronDown, HandCoins, ImagePlus, X } from 'lucide-react';
import Modal from '../../components/base/Modal';
import {
  BORDER_ERR,
  BORDER_OK,
  INPUT,
  LABEL,
  formatoMiles,
} from '../../components/base/formStyles';
import { mediosPago } from '../../constantes';
import { formatCOP, parseCOP } from '../../utils/formato';
import { useValidacion } from '../../hooks/useValidacion';
import { leerImagen, TIPOS_IMAGEN } from '../../utils/imagenes';

/**
 * Abono de la cuota inicial de una cotización a crédito.
 *
 * La empresa no financia nada sin un adelanto: antes de enviar la
 * cotización, el cliente debe pagar al menos la mitad del total y adjuntar
 * el comprobante, salvo que pague en efectivo en el local.
 *
 * Este modal no guarda nada en la API: el pago queda listo y viaja junto
 * con la cotización cuando el cliente pulsa "Enviar cotización".
 */
export default function CuotaInicialModal({ total, minimo, onSubmit, onClose }) {
  const [monto, setMonto] = useState(formatoMiles(String(minimo)));
  const [metodo, setMetodo] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [errorArchivo, setErrorArchivo] = useState('');
  const archivo = useRef(null);

  const valor = parseCOP(monto);
  const insuficiente = valor > 0 && valor < minimo;
  // El pago en efectivo se hace en el local, así que no hay pantallazo
  const requiereComprobante = metodo !== '' && metodo !== 'Efectivo';

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

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!valor) next.monto = 'Indica el valor que vas a abonar';
    else if (insuficiente) {
      next.monto = `La primera cuota debe ser de al menos ${formatCOP(minimo)} (50% del total).`;
    }
    if (!metodo) next.metodo = 'Selecciona el método de pago';
    if (requiereComprobante && !comprobante) next.comprobante = 'Adjunta el comprobante del pago';
    if (errorArchivo) next.comprobante = errorArchivo;
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;

    onSubmit?.({
      monto: formatCOP(valor),
      metodoPago: metodo,
      // Se guarda lo que haya subido, aunque en efectivo no sea obligatorio
      comprobante,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente',
    });
    close();
  };

  return (
    <Modal
      title="Abonar la cuota inicial"
      subtitle="La cotización a crédito solo se envía con el adelanto registrado."
      icon={<HandCoins size={17} />}
      size="md"
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
            onClick={() => guardar(close)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300"
          >
            <Check size={16} /> Registrar abono
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {/* ---- Lo que hay que cubrir ---- */}
        <dl className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Total de la cotización</dt>
            <dd className="font-bold text-slate-800 dark:text-slate-100">{formatCOP(total)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-emerald-700 dark:text-emerald-400">Cuota inicial mínima (50%)</dt>
            <dd className="font-bold text-emerald-700 dark:text-emerald-400">{formatCOP(minimo)}</dd>
          </div>
        </dl>

        <div>
          <label htmlFor="ci-monto" className={LABEL}>
            Monto a abonar (COP) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              id="ci-monto"
              inputMode="numeric"
              value={monto}
              onChange={(e) => {
                setMonto(formatoMiles(e.target.value));
                tocar('monto');
              }}
              className={`${INPUT} ${errores.monto || insuficiente ? BORDER_ERR : BORDER_OK} pl-8`}
            />
          </div>
          {errores.monto ? (
            <p className="mt-1 text-xs font-medium text-red-500">{errores.monto}</p>
          ) : (
            insuficiente && (
              <p className="mt-1 text-xs font-medium text-red-500">
                La primera cuota debe ser de al menos {formatCOP(minimo)} (50% del total).
              </p>
            )
          )}
        </div>

        <div>
          <label htmlFor="ci-metodo" className={LABEL}>
            Método de pago <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="ci-metodo"
              value={metodo}
              onChange={(e) => {
                setMetodo(e.target.value);
                tocar('metodo');
              }}
              className={`${INPUT} ${errores.metodo ? BORDER_ERR : BORDER_OK} cursor-pointer appearance-none pr-10`}
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

        {/* ---- Comprobante del adelanto ---- */}
        <div>
          <span className={LABEL}>
            Comprobante de pago {requiereComprobante && <span className="text-red-500">*</span>}
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
            !requiereComprobante && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                En efectivo no hace falta, pero puedes adjuntarlo igual.
              </p>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}
