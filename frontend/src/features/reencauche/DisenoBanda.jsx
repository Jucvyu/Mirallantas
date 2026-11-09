import { TONO_DISENO } from './reencauche';

/** Pastilla con el diseño de la banda (Direccional, Tracción, Mixta). */
export default function DisenoBanda({ diseno }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
        TONO_DISENO[diseno] ?? 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
      }`}
    >
      {diseno}
    </span>
  );
}
