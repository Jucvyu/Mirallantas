import { ICONOS } from '../iconosPorNombre';
import LiquidGlass from '../LiquidGlass';

const ACCENTS = {
  amber: 'bg-amber-400/15 text-amber-500 dark:text-amber-400',
  blue: 'bg-blue-500/15 text-blue-500 dark:text-blue-400',
  emerald: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400',
  violet: 'bg-violet-500/15 text-violet-500 dark:text-violet-400',
  red: 'bg-red-500/15 text-red-500 dark:text-red-400',
};

export default function StatCard({ label, value, sub, trend, trendUp, icon, accent = 'amber', indice }) {
  const Icon = ICONOS[icon] ?? ICONOS.Circle;
  const TrendIcon = trendUp ? ICONOS.TrendingUp : ICONOS.TrendingDown;

  return (
    <LiquidGlass variante="industrial" inclinacion={3} indice={indice} className="h-full p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold tracking-wide text-slate-600 dark:text-slate-400">{label}</p>
        <span data-capa className={`flex h-8 w-8 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>
          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{sub}</p>}
      {trend && (
        <p
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            trendUp ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          <TrendIcon size={13} aria-hidden="true" />
          {trend}
        </p>
      )}
    </LiquidGlass>
  );
}
