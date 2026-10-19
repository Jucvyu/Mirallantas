import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
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
import { ESTADO_COTIZACION_COMPLETADA, PLAZOS_CREDITO } from '../../../constantes';
import { useValidacion } from '../../../hooks/useValidacion';
import { useEnvio } from '../../../hooks/useEnvio';
import SelectorCotizaciones from '../shared/SelectorCotizaciones';

/** Solo se puede financiar una cotización ya completada. */
const esCompletada = (c) => c.estado === ESTADO_COTIZACION_COMPLETADA;

/**
 * "Nuevo crédito".
 *
 * El crédito nace de una venta concreta, así que la cotización de origen se
 * elige del mismo listado con buscador y filtros que usa la compra,
 * restringido a las cotizaciones completadas. El cliente no se pide: sale
 * de la cotización seleccionada. La API calcula la fecha límite y verifica
 * que el cliente no tenga ya otro crédito abierto.
 */
export default function NuevoCreditoModal({ onSubmit, onClose }) {
  const [cotizacion, setCotizacion] = useState(null);
  const [valor, setValor] = useState('');
  const [plazo, setPlazo] = useState(30);
  const { enviando, errorEnvio, enviar } = useEnvio();

  // Reglas del formulario: se revisan en vivo mientras el usuario escribe
  const { errores, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!cotizacion) next.cotizacion = 'Selecciona la cotización que se va a financiar';
    if (!valor.replace(/\D/g, '')) next.valor = 'Indica el monto del crédito';
    return next;
  });

  const guardar = (close) => {
    if (!validar()) return;

    // El servicio de créditos lo convierte para la API. Al abrirse, el
    // crédito debe todo su valor; la fecha límite la calcula el servidor.
    enviar(() => onSubmit({ cotizacion: cotizacion.id, valor, plazo }), close);
  };

  return (
    <Modal
      title="Nuevo crédito"
      subtitle="Financia una cotización completada: el cliente sale de la propia cotización."
      icon={<CreditCard size={17} />}
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
            <Check size={16} /> {enviando ? 'Guardando…' : 'Guardar crédito'}
          </button>
        </>
      )}
    >
      <div className="space-y-6">
        <AvisoError mensaje={errorEnvio} />

        {/* ---- Cotización financiada ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Cotización financiada</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <SelectorCotizaciones
            value={cotizacion?.id ?? ''}
            filtro={esCompletada}
            vacioLabel="No hay cotizaciones completadas para financiar."
            onChange={(c) => {
              setCotizacion(c);
              tocar('cotizacion');
            }}
            error={errores.cotizacion}
          />
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Cada cotización completada admite un único crédito.
          </p>
        </section>

        {/* ---- Condiciones ---- */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className={SECTION}>Condiciones</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cr-valor" className={LABEL}>
                Monto del crédito (COP) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  id="cr-valor"
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => {
                    setValor(formatoMiles(e.target.value));
                    tocar('valor');
                  }}
                  placeholder="2.000.000"
                  className={`${CAMPO} ${errores.valor ? BORDE_ERR : BORDE_OK} pl-8`}
                />
              </div>
              {errores.valor && <p className="mt-1 text-xs font-medium text-red-500">{errores.valor}</p>}
            </div>

            <div>
              <span className={LABEL}>Plazo</span>
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
                    {p} días
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                La fecha límite se calcula desde hoy con el plazo elegido.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
