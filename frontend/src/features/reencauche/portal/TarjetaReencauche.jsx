import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import AvisoError from '../../../components/base/AvisoError';
import { BORDER_OK, INPUT } from '../../../components/base/formStyles';
import Badge from '../../../components/base/Badge';
import { useEnvio } from '../../../hooks/useEnvio';
import { formatCOP } from '../../../utils/formato';
import Avance from '../Avance';
import DisenoBanda from '../DisenoBanda';
import LlantasLista from '../LlantasLista';
import { estadoParaCliente, fechaCorta, llantasTexto, pasoActual } from '../reencauche';

const BOTON_SECUNDARIO =
  'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700';
const BOTON_PRINCIPAL =
  'ml-pulsable rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60';

const dondeTexto = (s) => (s.lugar === 'Local' ? 'en el local' : `en tu dirección (${s.direccion})`);

/** Fila de total: a la izquierda qué es, a la derecha la cifra. */
function Total({ etiqueta, valor, nota }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{etiqueta}</p>
        {nota && <p className="text-xs text-slate-500 dark:text-slate-400">{nota}</p>}
      </div>
      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{valor}</p>
    </div>
  );
}

/** Lo que pidió el cliente: una fila por banda, con la medida y cuántas llantas. */
function ItemsPedidos({ items }) {
  return (
    <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-white/5 dark:border-white/10">
      {items.map((i) => (
        <li key={`${i.bandaId}-${i.medida}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{i.banda}</span>
            {i.diseno && <DisenoBanda diseno={i.diseno} />}
          </span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {llantasTexto(i.cantidad)} · {i.medida}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Una solicitud de reencauche en el portal: su avance, lo que pidió (una o
 * varias bandas), lo que se encontró en cada llanta y lo que el cliente
 * puede hacer en ese momento (confirmar la fecha que propuso el asesor,
 * aceptar la cotización sin pagar o cancelar antes de la revisión, con el
 * motivo).
 */
export default function TarjetaReencauche({ solicitud: s, onResponder, onConfirmarFecha, onCancelar }) {
  const estado = estadoParaCliente(s);
  const cerrada = ['No aceptada', 'Sin llantas aptas', 'Cancelada'].includes(s.estado);
  const cancelable = ['Por agendar', 'Por confirmar', 'Agendada'].includes(s.estado);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();

  let cuerpo = null;
  if (s.estado === 'Por agendar') {
    cuerpo = (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Te llamamos para agendar la revisión gratis {dondeTexto(s)}. Fecha que prefieres:{' '}
        <b className="font-semibold">{fechaCorta(s.fechaPreferida)}</b>.
      </p>
    );
  } else if (s.estado === 'Por confirmar') {
    // Amarillo: el asesor propuso otro día y espera la confirmación del cliente
    cuerpo = (
      <div className="rounded-xl border border-yellow-400/70 bg-yellow-300/20 p-4 dark:border-yellow-400/40 dark:bg-yellow-400/10">
        <p className="flex items-start gap-2 text-sm text-yellow-900 dark:text-yellow-200">
          <CalendarClock size={17} className="mt-0.5 shrink-0" />
          <span>
            No pudimos el {fechaCorta(s.fechaPreferida)}. Te proponemos revisar tus llantas el{' '}
            <b className="font-bold">{fechaCorta(s.fechaRevision)}</b> {dondeTexto(s)}. ¿Te sirve?
          </span>
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-yellow-800/80 dark:text-yellow-200/70">Si no te sirve, cancela y pide otra fecha.</span>
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviar(onConfirmarFecha)}
            className="ml-pulsable rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-yellow-300 disabled:opacity-60"
          >
            Confirmar fecha
          </button>
        </div>
      </div>
    );
  } else if (s.estado === 'Agendada') {
    cuerpo = (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Revisión gratis el <b className="font-semibold">{fechaCorta(s.fechaRevision)}</b> {dondeTexto(s)}. El asesor revisa cada
        llanta contigo y te dice cuáles sirven.
      </p>
    );
  } else if (s.estado === 'Cancelada') {
    cuerpo = (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Solicitud cancelada. <span className="font-semibold">Motivo:</span> {s.motivoCancelacion}
      </p>
    );
  } else if (s.estado === 'No aceptada') {
    cuerpo = <p className="text-sm text-slate-600 dark:text-slate-300">No aceptaste la cotización. Te devolvemos tus llantas sin costo.</p>;
  }

  const porPagar = s.valor - s.cobrado;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-brand-navy-800">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {s.items.length > 1 ? `Reencauche de ${llantasTexto(s.cantidad)}` : s.items[0].banda}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {s.numero} · {s.items.length > 1 ? `${s.items.length} bandas` : `${llantasTexto(s.cantidad)} ${s.medida}`} · pedida el{' '}
            {fechaCorta(s.creadoEn)}
          </p>
        </div>
        <Badge tone={estado.tono}>{estado.texto}</Badge>
      </header>

      {!cerrada && (
        <div className="mt-4">
          <Avance paso={pasoActual(s)} />
        </div>
      )}

      {/* Lo pedido, mientras no haya llantas revisadas (después se ve cada llanta) */}
      {s.llantas.length === 0 && s.items.length > 1 && <ItemsPedidos items={s.items} />}

      {cuerpo && <div className="mt-4">{cuerpo}</div>}

      {s.llantas.length > 0 && (
        <div className="mt-3">
          <LlantasLista llantas={s.llantas} paraCliente />
        </div>
      )}

      {s.estado === 'Sin llantas aptas' && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Ninguna llanta sirve para reencauche. Te las devolvemos sin ningún costo.
        </p>
      )}

      {s.estado === 'Cotizada' && (
        <div className="mt-2 space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
          <Total
            etiqueta="A pagar cuando recibas tus llantas"
            valor={s.valorTexto}
            nota={`${s.aptas} de ${llantasTexto(s.revisadas)} sirven. Aceptar no te cobra nada.`}
          />
          <AvisoError mensaje={errorEnvio} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={enviando} onClick={() => enviar(() => onResponder(false))} className={BOTON_SECUNDARIO}>
              No, gracias
            </button>
            <button type="button" disabled={enviando} onClick={() => enviar(() => onResponder(true))} className={BOTON_PRINCIPAL}>
              Aceptar cotización
            </button>
          </div>
        </div>
      )}

      {s.estado === 'Aceptada' && (
        <div className="mt-2 space-y-2 border-t border-slate-200 pt-4 dark:border-white/10">
          {porPagar > 0 ? (
            <Total etiqueta="Por pagar al recibir" valor={formatCOP(porPagar)} nota="Pagas cada llanta cuando te la entregamos." />
          ) : (
            <Total etiqueta="Pagado" valor={s.cobradoTexto} nota="Todo entregado. ¡Gracias!" />
          )}
          {porPagar > 0 && s.cobrado > 0 && (
            <p className="text-right text-xs text-emerald-600 dark:text-emerald-400">Ya pagaste {s.cobradoTexto}</p>
          )}
        </div>
      )}

      {cancelable && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <AvisoError mensaje={errorEnvio} className="w-full" />
          {confirmando ? (
            <div className="w-full space-y-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  ¿Por qué cancelas la solicitud? <span className="text-red-500">*</span>
                </span>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: la fecha que me proponen no me sirve"
                  className={`${INPUT} ${BORDER_OK} resize-none`}
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmando(false)} className={BOTON_SECUNDARIO}>
                  Volver
                </button>
                <button
                  type="button"
                  disabled={enviando || motivo.trim().length < 3}
                  onClick={() => enviar(() => onCancelar(motivo.trim()))}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  Cancelar solicitud
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className="text-sm font-semibold text-slate-500 hover:text-red-500 dark:text-slate-400">
              Cancelar solicitud
            </button>
          )}
        </div>
      )}
    </article>
  );
}
