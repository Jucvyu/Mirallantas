/**
 * Dibujo esquemático de la pisada de cada diseño de banda, para que el
 * cliente reconozca cuál es cuál sin leer la ficha técnica:
 *
 *   Direccional  surcos rectos a lo largo (eje delantero)
 *   Tracción     bloques con surcos en diagonal que muerden al arrancar
 *   Mixta        hombros en bloque y centro en zigzag
 */
function trazos(diseno) {
  if (diseno === 'Direccional') return 'M6 11H114M6 22H114M6 33H114';
  if (diseno === 'Tracción') {
    let d = 'M2 22H118';
    for (let x = 12; x < 120; x += 12) d += `M${x} 3L${x - 6} 18M${x - 6} 26L${x} 41`;
    return d;
  }
  let d = 'M4 22';
  for (let x = 12, arriba = true; x <= 116; x += 8, arriba = !arriba) d += `L${x} ${arriba ? 15 : 29}`;
  for (let x = 8; x < 120; x += 12) d += `M${x} 3V10M${x} 34V41`;
  return d;
}

export default function PisadaBanda({ diseno, className = '' }) {
  return (
    <svg viewBox="0 0 120 44" aria-hidden="true" className={`block h-auto w-full rounded-lg ${className}`}>
      <rect width="120" height="44" rx="6" className="fill-slate-800 dark:fill-slate-700/70" />
      <path
        d={trazos(diseno)}
        className="stroke-slate-500 dark:stroke-slate-400/60"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
