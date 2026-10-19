import { ChevronDown } from 'lucide-react';
import { statusClass } from '../Badge';

/**
 * Estado editable directamente desde el listado.
 *
 * Se ve igual que un `Badge` pero es un `<select>`: al cambiarlo, la fila
 * se actualiza en el acto. Si no se pasa `options` u `onChange`, se
 * comporta como una pastilla de solo lectura.
 *
 * `flow` define el flujo permitido ({ estado: [siguientes] }): si llega, el
 * desplegable solo ofrece las transiciones válidas desde el estado actual,
 * y los estados finales quedan bloqueados.
 */
export default function StatusSelect({ value, options, onChange, flow, label = 'Estado' }) {
  const color = statusClass(value);

  // Con flujo definido, las opciones se recortan a las transiciones válidas
  const disponibles = flow ? flow[value] ?? [] : options;
  const esFinal = Boolean(flow) && disponibles.length === 0;

  if (!disponibles || !onChange || esFinal) {
    return (
      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${color}`}>
        {value}
      </span>
    );
  }

  return (
    <span className={`relative inline-flex items-center rounded-md text-xs font-semibold ${color}`}>
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer appearance-none rounded-md bg-transparent py-1 pl-2.5 pr-7 text-xs font-semibold text-current focus:outline-none focus:ring-2 focus:ring-amber-400/50"
      >
        {!disponibles.includes(value) && value && <option value={value}>{value}</option>}
        {disponibles.map((o) => (
          <option key={o} value={o} className="bg-white text-slate-800 dark:bg-brand-navy-800 dark:text-slate-100">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 opacity-70" />
    </span>
  );
}
