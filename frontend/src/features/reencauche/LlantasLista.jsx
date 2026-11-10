import Badge from '../../components/base/Badge';
import { ESTADO_LLANTA_CLIENTE, TONO_ORDEN } from './reencauche';

const previosTexto = (n) => (n ? `${n} ${n === 1 ? 'reencauche previo' : 'reencauches previos'}` : 'Sin reencauches previos');

/**
 * Llantas revisadas de una solicitud, una por fila: qué se encontró, en qué
 * va y cuánto vale. Lo que no se cobra (no apta o rechazada en la planta) lo
 * dice en vez de mostrar un valor.
 *
 *   paraCliente  usa los textos que ve el cliente en el portal
 */
export default function LlantasLista({ llantas, paraCliente = false }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-white/5">
      {llantas.map((l) => {
        const apta = l.resultado === 'Apta';
        const noSeCobra = !apta || l.estado === 'Rechazada en planta';

        // Lo que se dice debajo de la llanta: la banda, o por qué no sirvió
        const detalle = !apta
          ? l.motivoNoApta
          : l.estado === 'Rechazada en planta'
            ? `${paraCliente ? 'La reencauchadora no pudo reencaucharla' : 'Rechazada en planta'}: ${l.motivoPlanta}`
            : [l.banda, l.anchoMm && `${l.anchoMm} mm`, !paraCliente && l.tercero].filter(Boolean).join(' · ');

        const estado = !apta ? (
          <Badge tone="No apta">No apta</Badge>
        ) : l.estado ? (
          <Badge tone={TONO_ORDEN[l.estado]}>{paraCliente ? ESTADO_LLANTA_CLIENTE[l.estado] : l.estado}</Badge>
        ) : (
          <Badge tone="Apta">Apta</Badge>
        );

        return (
          <li key={l.id ?? l.posicion} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Llanta {l.posicion} <span className="font-normal text-slate-400">· ID {l.identificador}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {l.medida} · {previosTexto(l.reencauchesPrevios)}
              </p>
              {detalle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detalle}</p>}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
              {estado}
              <div className="min-w-[7.5rem] text-right">
                {noSeCobra ? (
                  <span className="text-xs font-semibold text-slate-400">No se cobra</span>
                ) : (
                  <>
                    <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{l.valorTexto}</p>
                    <p className="text-[11px] text-slate-400">
                      {l.estado === 'Entregada'
                        ? `Pagado · ${l.pagoMedio}`
                        : paraCliente
                          ? 'Pagas al recibirla'
                          : 'Se cobra al entregar'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
