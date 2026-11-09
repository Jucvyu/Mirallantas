import { PASOS } from './reencauche';

/**
 * Avance de una solicitud en cinco pasos. En pantallas pequeñas se lee solo
 * el paso actual debajo de las barras; las barras siguen mostrando cuánto
 * falta.
 *
 *   paso  0–4 = el paso en curso · 5 = todo terminado
 */
export default function Avance({ paso }) {
  const terminado = paso >= PASOS.length;
  return (
    <div>
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Avance del reencauche">
        {PASOS.map((nombre, i) => {
          const hecho = i < paso;
          const actual = i === paso;
          return (
            <li key={nombre} aria-current={actual ? 'step' : undefined} className="min-w-0">
              <span
                className={`block h-1.5 rounded-full ${
                  hecho ? 'bg-emerald-500' : actual ? 'bg-amber-400' : 'bg-slate-200 dark:bg-white/10'
                }`}
              />
              <span
                className={`mt-1.5 hidden truncate text-[11px] sm:block ${
                  actual
                    ? 'font-bold text-slate-800 dark:text-slate-100'
                    : hecho
                      ? 'font-medium text-slate-500 dark:text-slate-400'
                      : 'font-medium text-slate-400 dark:text-slate-500'
                }`}
              >
                {nombre}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 sm:hidden">
        {terminado ? 'Terminado' : `Paso ${paso + 1} de ${PASOS.length} · ${PASOS[paso]}`}
      </p>
    </div>
  );
}
