import { useRef, useState } from 'react';
import { nuevaClaveIdempotencia } from '../../services';
import { leerImagen, TIPOS_IMAGEN } from '../../utils/imagenes';
import { Check, ChevronDown, ImagePlus, Wallet, X } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Badge from '../../components/base/Badge';
import Modal from '../../components/base/Modal';
import { ABONO_MINIMO, MEDIOS_PAGO_CLIENTE } from '../../constantes';
import { usePortal } from '../../context/PortalContext';
import { useValidacion } from '../../hooks/useValidacion';
import { useEnvio } from '../../hooks/useEnvio';
import { formatCOP, parseCOP } from '../../utils/formato';

import {
  BORDER_ERR,
  BORDER_OK,
  INPUT,
  LABEL,
  SECTION,
  formatoMiles,
} from '../../components/base/formStyles';
import DatosTransferencia from '../shared/DatosTransferencia';

/**
 * Registro de un abono desde el portal.
 *
 * El abono siempre se aplica al crédito desde el que se abrió el modal
 * (`creditoId`), así que aquí no se elige: solo se muestra a cuál va. El
 * cliente indica el monto y, si paga por transferencia, adjunta el
 * pantallazo de la consignación; la fecha la pone el sistema y el asesor
 * valida el soporte al confirmar el pago.
 *
 * `onSubmit(datos)` guarda en la API; si falla, el mensaje se muestra aquí
 * y el modal no se cierra.
 *
 * `reintento` (opcional) es un abono rechazado: el formulario arranca con
 * su monto y su medio de pago para volver a subirlo con otro comprobante.
 */
export default function RegistrarAbonoModal({ creditoId, reintento = null, onSubmit, onClose }) {
  // Una clave por formulario abierto: si el envío se repite, no se duplica el abono
  const [claveIdempotencia] = useState(nuevaClaveIdempotencia);
  const [monto, setMonto] = useState(() => (reintento ? formatoMiles(String(parseCOP(reintento.monto))) : ''));
  const [metodo, setMetodo] = useState(reintento?.metodoPago ?? '');
  const [soporte, setSoporte] = useState('');
  const [errorArchivo, setErrorArchivo] = useState('');
  const fileInput = useRef(null);

  const { creditos } = usePortal();
  const { enviando, errorEnvio, enviar } = useEnvio();
  const credito = creditos.find((c) => c.id === creditoId);
  // El pantallazo solo tiene sentido en transferencia: el efectivo se paga
  // en el local y la tarjeta deja su propio recibo.
  const requiereSoporte = metodo === 'Transferencia';
  const saldoActual = parseCOP(credito?.saldoPendiente);
  const montoNum = parseCOP(monto);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    leerImagen(file)
      .then((dataUrl) => {
        setSoporte(dataUrl);
        setErrorArchivo('');
        tocar('soporte');
      })
      .catch((error) => {
        setErrorArchivo(error.message);
        tocar('soporte');
      });
  };

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores: errors, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!montoNum) next.monto = 'Ingresa el monto abonado';
    else if (credito && montoNum > saldoActual) next.monto = 'El monto supera el saldo pendiente';
    // Mínimo $20.000, salvo el último pago (por el saldo exacto)
    else if (montoNum < ABONO_MINIMO && montoNum !== saldoActual)
      next.monto = `El abono mínimo es de ${formatCOP(ABONO_MINIMO)} (o paga el saldo exacto de ${formatCOP(saldoActual)})`;
    if (!metodo) next.metodo = 'Este campo es obligatorio';
    if (requiereSoporte && !soporte) next.soporte = 'Adjunta el pantallazo de la consignación';
    if (errorArchivo) next.soporte = errorArchivo;
    return next;
  });

  const submit = (close) => {
    if (!validar()) return;

    // `credito` dice a qué crédito va; el resto es el cuerpo para la API
    const datos = {
      credito: creditoId,
      monto: montoNum,
      medioPago: metodo,
      // La consignación es el comprobante que el asesor debe validar
      comprobante: requiereSoporte ? soporte : null,
      claveIdempotencia,
    };
    enviar(() => onSubmit(datos), close);
  };

  return (
    <Modal
      title="Registrar abono"
      subtitle={`Se aplicará al crédito ${creditoId}`}
      icon={<Wallet size={17} />}
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
            disabled={enviando}
            onClick={() => submit(close)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            <Check size={16} /> {enviando ? 'Enviando…' : 'Registrar abono'}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={errorEnvio} />
        {/* ---- Crédito al que se aplica, solo informativo ---- */}
        {credito && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{credito.id}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {credito.cotizacion} · vence el {credito.fechaLimite}
                </p>
              </div>
              <Badge>{credito.estado}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm dark:border-white/10">
              <span className="text-slate-500 dark:text-slate-400">Saldo pendiente</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{credito.saldoPendiente}</span>
            </div>
          </div>
        )}

        {/* ---- Datos del pago ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Datos del abono</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ab-monto" className={LABEL}>
                Monto a abonar (COP) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  id="ab-monto"
                  value={monto}
                  inputMode="numeric"
                  onChange={(e) => setMonto(formatoMiles(e.target.value))}
                  placeholder="500000"
                  className={`${INPUT} ${errors.monto ? BORDER_ERR : BORDER_OK} pl-7`}
                />
              </div>
              {errors.monto ? (
                <p className="mt-1 text-xs font-medium text-red-500">{errors.monto}</p>
              ) : (
                credito &&
                montoNum > 0 && (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Quedaría {formatCOP(Math.max(0, saldoActual - montoNum))}
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
                    if (e.target.value === 'Efectivo') setSoporte('');
                  }}
                  className={`${INPUT} ${errors.metodo ? BORDER_ERR : BORDER_OK} appearance-none pr-9`}
                >
                  <option value="">Seleccionar...</option>
                  {MEDIOS_PAGO_CLIENTE.map((m) => (
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
              {errors.metodo && <p className="mt-1 text-xs font-medium text-red-500">{errors.metodo}</p>}
            </div>
          </div>
        </section>

        {/* ---- Soporte de la consignación: solo en transferencia ---- */}
        {requiereSoporte && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Soporte de la consignación</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="mb-3">
            <DatosTransferencia />
          </div>

          {soporte ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
              <img src={soporte} alt="Pantallazo de la consignación" className="h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => setSoporte('')}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                aria-label="Quitar soporte"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={`flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-slate-400 hover:border-amber-400 hover:text-amber-500 ${
                errors.soporte ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <ImagePlus size={28} strokeWidth={1.5} />
              <span className="text-xs font-medium">Sube el pantallazo de la consignación (JPG o PNG)</span>
            </button>
          )}
          <input ref={fileInput} type="file" accept={TIPOS_IMAGEN} className="hidden" onChange={handleFile} />
          {errors.soporte && <p className="mt-1 text-xs font-medium text-red-500">{errors.soporte}</p>}
        </section>
        )}
      </div>
    </Modal>
  );
}
