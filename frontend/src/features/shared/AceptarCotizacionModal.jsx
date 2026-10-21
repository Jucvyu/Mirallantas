import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Modal from '../../components/base/Modal';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL, formatoMiles } from '../../components/base/formStyles';
import {
  CUOTA_INICIAL_PORCENTAJE,
  cuotaMinimaDe,
  INTERES_POR_PLAZO,
  MEDIOS_PAGO_CLIENTE,
  PLAZOS_CREDITO,
} from '../../constantes';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService } from '../../services';
import { formatCOP } from '../../utils/formato';
import { CamposPago, pideComprobante } from './PagoConsignacion';

/** "$ 1.250.000" o "1.250.000" → 1250000 */
const aNumero = (texto) => Number(String(texto ?? '').replace(/\D/g, '')) || 0;

/** "2026-10-28" → "28/10/2026" (sin pasar por Date: no hay desfase de zona horaria) */
const fechaCorta = (f) => (f ? f.slice(0, 10).split('-').reverse().join('/') : '');

/**
 * Aceptar la cotización formal (dentro de su vigencia):
 *
 *   Contado → se paga el 100 %: medio de pago y consignación (salvo en efectivo).
 *   Crédito → plazo (30, 60 o 90 días, con su interés) y cuota inicial de al
 *             menos el 30 % del total; el resto se financia y queda una
 *             solicitud de crédito para que el asesor la apruebe.
 *
 * Lo usa el cliente desde su portal (`desdePortal`) y el asesor en el local.
 * En los dos casos solo se ofrece efectivo o transferencia (tarjeta y
 * "otro" no aplican a este flujo; la API también lo exige). Los valores de
 * aquí son una vista previa: la API recalcula todo con los precios guardados.
 */
export default function AceptarCotizacionModal({ cotizacion, desdePortal = false, onAceptada, onClose }) {
  const { enviando, errorEnvio, enviar } = useEnvio();
  const [metodoPago, setMetodoPago] = useState('Contado');
  const [plazo, setPlazo] = useState(30);
  const [pago, setPago] = useState({ medioPago: '', comprobante: '' });
  const [cuotaTexto, setCuotaTexto] = useState('');
  const [intento, setIntento] = useState(false);

  const esCredito = metodoPago === 'Crédito';
  const subtotal = cotizacion.subtotalValor ?? 0;
  const interes = esCredito ? Math.round(subtotal * (INTERES_POR_PLAZO[plazo] ?? 0)) : 0;
  const total = subtotal + interes;
  const cuotaMinima = esCredito ? cuotaMinimaDe(total) : 0;
  const cuota = cuotaTexto === '' ? cuotaMinima : aNumero(cuotaTexto);
  const medios = MEDIOS_PAGO_CLIENTE;

  // Errores (se muestran después del primer intento)
  const errores = {};
  if (!pago.medioPago) errores.medioPago = 'Elige el medio de pago';
  else if (pideComprobante(pago.medioPago) && !pago.comprobante) errores.comprobante = 'Sube el comprobante del pago';
  if (esCredito && cuota < cuotaMinima) {
    errores.cuota = `La cuota inicial debe ser de al menos ${formatCOP(cuotaMinima)} (${CUOTA_INICIAL_PORCENTAJE} % del total).`;
  }
  if (esCredito && cuota >= total) errores.cuota = 'Si pagas todo de una vez, elige contado.';
  const visibles = intento ? errores : {};

  const aceptar = (cerrar) => {
    setIntento(true);
    if (Object.keys(errores).length > 0) return;
    enviar(async () => {
      await cotizacionesService.aceptar(
        cotizacion.id,
        esCredito
          ? { metodoPago, plazoDias: plazo, cuotaInicial: { ...pago, monto: cuota } }
          : { metodoPago, pago },
        { desdePortal },
      );
      await onAceptada?.();
    }, cerrar);
  };

  const opcionBoton = (activo) =>
    `flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
      activo
        ? 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400'
        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
    }`;

  return (
    <Modal
      title="Aceptar la cotización"
      subtitle={`${cotizacion.id} · válida hasta el ${fechaCorta(cotizacion.venceEn)}`}
      icon={<HandCoins size={17} />}
      size="md"
      onClose={onClose}
      footer={(cerrar) => (
        <button
          type="button"
          disabled={enviando}
          onClick={() => aceptar(cerrar)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
        >
          <HandCoins size={16} /> {enviando ? 'Enviando…' : esCredito ? 'Solicitar el crédito' : 'Enviar el pago'}
        </button>
      )}
    >
      <div className="space-y-4">
        <AvisoError mensaje={errorEnvio} />

        <div>
          <span className={LABEL}>¿Cómo vas a pagar?</span>
          <div className="flex gap-2" role="radiogroup">
            {['Contado', 'Crédito'].map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metodoPago === m}
                onClick={() => setMetodoPago(m)}
                className={opcionBoton(metodoPago === m)}
              >
                {m === 'Contado' ? 'De contado (100 %)' : `A crédito (inicial ${CUOTA_INICIAL_PORCENTAJE} %)`}
              </button>
            ))}
          </div>
        </div>

        {esCredito && (
          <>
            <div>
              <span className={LABEL}>Plazo</span>
              <div className="flex gap-2">
                {PLAZOS_CREDITO.map((p) => (
                  <button key={p} type="button" onClick={() => setPlazo(p)} aria-pressed={plazo === p} className={opcionBoton(plazo === p)}>
                    {p} días · {(INTERES_POR_PLAZO[p] * 100).toFixed(0)} %
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="ac-cuota" className={LABEL}>
                Cuota inicial (COP)
              </label>
              <input
                id="ac-cuota"
                inputMode="numeric"
                value={cuotaTexto === '' ? formatoMiles(String(cuotaMinima)) : cuotaTexto}
                onChange={(e) => setCuotaTexto(formatoMiles(e.target.value))}
                className={`${INPUT} ${visibles.cuota ? BORDER_ERR : BORDER_OK}`}
              />
              <p className={`mt-1 text-xs ${visibles.cuota ? 'font-medium text-red-500' : 'text-slate-400'}`}>
                {visibles.cuota ?? `Mínimo ${formatCOP(cuotaMinima)}, el ${CUOTA_INICIAL_PORCENTAJE} % del total.`}
              </p>
            </div>
          </>
        )}

        <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
          <CamposPago
            pago={pago}
            onCambio={setPago}
            errores={visibles}
            medios={medios}
            etiqueta={esCredito ? 'Medio de pago de la cuota inicial' : 'Medio de pago'}
          />
        </div>

        <dl className="space-y-1.5 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Valor de las llantas</dt>
            <dd className="font-semibold">{formatCOP(subtotal)}</dd>
          </div>
          {esCredito && (
            <>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Interés a {plazo} días</dt>
                <dd className="font-semibold">{formatCOP(interes)}</dd>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Cuota inicial</dt>
                <dd className="font-semibold">{formatCOP(cuota)}</dd>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Saldo a financiar</dt>
                <dd className="font-semibold">{formatCOP(Math.max(total - cuota, 0))}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-amber-400/40 pt-2">
            <dt className="font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {esCredito ? 'Total a crédito' : 'Total a pagar'}
            </dt>
            <dd className="text-lg font-bold text-slate-900 dark:text-white">{formatCOP(total)}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {esCredito
            ? 'Un asesor revisa la cuota inicial y aprueba el crédito; luego sigue el pedido.'
            : 'Tu pedido sigue su proceso cuando un asesor confirme el pago.'}
        </p>
      </div>
    </Modal>
  );
}
