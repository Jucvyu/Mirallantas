import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Modal from '../../components/base/Modal';
import { LABEL } from '../../components/base/formStyles';
import {
  CUOTA_INICIAL_PORCENTAJE,
  cuotaMinimaDe,
  INTERES_POR_PLAZO,
  MEDIOS_PAGO_CLIENTE,
  PLAZOS_CREDITO,
} from '../../constantes';
import { useEnvio } from '../../hooks/useEnvio';
import { cotizacionesService } from '../../services';
import { formatCOP, fechaISO } from '../../utils/formato';
import { CamposPago, pideComprobante } from './PagoConsignacion';

/** Fecha en el formato estándar AAAA-MM-DD */
const fechaCorta = (f) => fechaISO(f);

/**
 * Aceptar la cotización formal (dentro de su vigencia):
 *
 *   Contado → se paga el 100 %: medio de pago y consignación (salvo en efectivo).
 *   Crédito → solo el plazo (30, 60 o 90 días, con su interés). No se paga
 *             nada al aceptar: queda una solicitud de crédito; cuando el
 *             asesor la aprueba, el cliente paga la cuota inicial (30 %).
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
  const [intento, setIntento] = useState(false);

  const esCredito = metodoPago === 'Crédito';
  const subtotal = cotizacion.subtotalValor ?? 0;
  const interes = esCredito ? Math.round(subtotal * (INTERES_POR_PLAZO[plazo] ?? 0)) : 0;
  const total = subtotal + interes;
  const cuotaMinima = esCredito ? cuotaMinimaDe(total) : 0;
  // La cuota inicial es el 30 %: se paga después de aprobado el crédito
  const cuota = cuotaMinima;
  const medios = MEDIOS_PAGO_CLIENTE;

  // Errores (se muestran después del primer intento). A crédito no se paga nada aquí.
  const errores = {};
  if (!esCredito && !pago.medioPago) errores.medioPago = 'Elige el medio de pago';
  else if (!esCredito && pideComprobante(pago.medioPago) && !pago.comprobante) errores.comprobante = 'Sube el comprobante del pago';
  const visibles = intento ? errores : {};

  const aceptar = (cerrar) => {
    setIntento(true);
    if (Object.keys(errores).length > 0) return;
    enviar(async () => {
      await cotizacionesService.aceptar(
        cotizacion.id,
        esCredito ? { metodoPago, plazoDias: plazo } : { metodoPago, pago },
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
                    {p} días · {(INTERES_POR_PLAZO[p] * 100).toLocaleString('es-CO')} %
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              No pagas nada ahora. Cuando aprobemos tu crédito, pagas la cuota inicial de{' '}
              <strong>{formatCOP(cuota)}</strong> ({CUOTA_INICIAL_PORCENTAJE} % del total) desde "Mis cotizaciones".
            </p>
          </>
        )}

        {/* De contado se paga ya; a crédito, la cuota se paga después de aprobar */}
        {!esCredito && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
            <CamposPago pago={pago} onCambio={setPago} errores={visibles} medios={medios} etiqueta="Medio de pago" />
          </div>
        )}

        <dl className="space-y-1.5 rounded-xl border-2 border-amber-400 bg-amber-400/10 px-5 py-4 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Valor de la cotización</dt>
            <dd className="font-semibold">{formatCOP(subtotal)}</dd>
          </div>
          {esCredito && (
            <>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Interés a {plazo} días</dt>
                <dd className="font-semibold">{formatCOP(interes)}</dd>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Cuota inicial (después de aprobar)</dt>
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
            ? 'Un asesor revisa y aprueba el crédito; luego pagas la cuota inicial y sigue el pedido.'
            : 'Tu pedido sigue su proceso cuando un asesor confirme el pago.'}
        </p>
      </div>
    </Modal>
  );
}
