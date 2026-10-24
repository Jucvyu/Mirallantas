import { useRef, useState } from 'react';
import { ChevronDown, ImagePlus, X } from 'lucide-react';
import Badge from '../../components/base/Badge';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from '../../components/base/formStyles';
import { mediosPago } from '../../constantes';
import { leerImagen, TIPOS_IMAGEN } from '../../utils/imagenes';
import DatosTransferencia from './DatosTransferencia';

// =========================================================================
// Piezas del pago de contado de una cotización (consignación).
//
//   <CamposPago>        elegir el medio de pago y subir la consignación
//   <HistorialPagos>    las consignaciones de una cotización, de la más
//                       nueva a la más vieja, con su color:
//                         amarillo = pendiente de confirmación
//                         rojo     = rechazada (atenuada)
//                         normal   = aprobada
// =========================================================================

/** ¿El medio elegido necesita la consignación? (en efectivo se paga en el local) */
export const pideComprobante = (medio) => Boolean(medio) && medio !== 'Efectivo';

/**
 * Campos del pago. `pago` = { medioPago, comprobante } y `onCambio(pago)`.
 * `errores` = { medioPago, comprobante } para mostrar los avisos.
 * `medios`: los que se ofrecen (el cliente del portal solo efectivo y
 * transferencia: MEDIOS_PAGO_CLIENTE).
 */
export function CamposPago({ pago, onCambio, errores = {}, medios = mediosPago, etiqueta = '¿Cómo vas a pagar?' }) {
  const archivo = useRef(null);
  const [errorArchivo, setErrorArchivo] = useState('');

  const cargar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    leerImagen(file)
      .then((dataUrl) => {
        setErrorArchivo('');
        onCambio({ ...pago, comprobante: dataUrl });
      })
      .catch((error) => setErrorArchivo(error.message));
  };

  const errorComprobante = errorArchivo || errores.comprobante;

  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL} htmlFor="pago-medio">
          {etiqueta} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            id="pago-medio"
            value={pago.medioPago ?? ''}
            onChange={(e) => onCambio({ ...pago, medioPago: e.target.value })}
            className={`${INPUT} ${errores.medioPago ? BORDER_ERR : BORDER_OK} cursor-pointer appearance-none pr-10`}
          >
            <option value="">Seleccionar...</option>
            {medios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        {errores.medioPago && <p className="mt-1 text-xs font-medium text-red-500">{errores.medioPago}</p>}
      </div>

      {pago.medioPago === 'Efectivo' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Pagas en el local; un asesor confirmará el pago.</p>
      )}

      {pago.medioPago === 'Transferencia' && <DatosTransferencia />}
      {pideComprobante(pago.medioPago) && (
        <div>
          <span className={LABEL}>
            Consignación <span className="text-red-500">*</span>
          </span>
          {pago.comprobante ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
              <img src={pago.comprobante} alt="Consignación" className="max-h-48 w-full object-contain" />
              <button
                type="button"
                onClick={() => onCambio({ ...pago, comprobante: '' })}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white"
                aria-label="Quitar la consignación"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => archivo.current?.click()}
              className={`flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-slate-400 hover:border-amber-400 hover:text-amber-500 ${
                errorComprobante ? 'border-red-400' : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <ImagePlus size={22} strokeWidth={1.5} />
              <span className="text-xs font-medium">Sube el pantallazo de la consignación</span>
            </button>
          )}
          <input ref={archivo} type="file" accept={TIPOS_IMAGEN} className="hidden" onChange={cargar} />
          {errorComprobante && <p className="mt-1 text-xs font-medium text-red-500">{errorComprobante}</p>}
        </div>
      )}
    </div>
  );
}

/** Estilo de cada consignación según su estado. */
const ESTILO = {
  'En revisión': 'border-2 border-amber-400 bg-amber-400/10',
  Rechazado: 'border-2 border-red-400/70 opacity-60',
  Aprobado: 'border border-slate-200 dark:border-white/10',
};

/** Una consignación: valor, medio, fecha, estado, motivo y la imagen. */
export function TarjetaPago({ pago }) {
  return (
    <div className={`rounded-xl p-3 ${ESTILO[pago.estado] ?? ESTILO.Aprobado}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-800 dark:text-slate-100">
          {pago.monto} · {pago.medioPago}
        </span>
        <Badge tone={pago.estado === 'En revisión' ? 'Pendiente' : pago.estado}>
          {pago.estado === 'En revisión' ? 'Pendiente de confirmación' : pago.estado}
        </Badge>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{pago.fechaTexto}</p>
      {pago.motivo && <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">Motivo: {pago.motivo}</p>}
      {pago.comprobante ? (
        <a href={pago.comprobante} target="_blank" rel="noreferrer" title="Abrir la consignación completa">
          <img
            src={pago.comprobante}
            alt="Consignación"
            className="mt-2 max-h-56 w-full rounded-lg border border-slate-200 bg-white object-contain dark:border-white/10 dark:bg-white/5"
          />
        </a>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">Pago en efectivo: sin consignación.</p>
      )}
    </div>
  );
}

/**
 * Pago de contado dentro del detalle de una cotización: la consignación más
 * reciente y, si hubo más de un intento, el botón "Desplegar historial de
 * pagos" con las anteriores. Con un solo pago aprobado, solo se ve ese.
 */
export function HistorialPagos({ pagos = [] }) {
  const [abierto, setAbierto] = useState(false);
  if (pagos.length === 0) return null;
  const [ultimo, ...anteriores] = pagos;

  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        Pago de contado
      </p>
      <TarjetaPago pago={ultimo} />
      {anteriores.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {abierto ? 'Ocultar historial de pagos' : `Desplegar historial de pagos (${anteriores.length})`}
            <ChevronDown size={13} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>
          {abierto && (
            <div className="mt-2 space-y-2">
              {anteriores.map((p) => (
                <TarjetaPago key={p.id} pago={p} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
