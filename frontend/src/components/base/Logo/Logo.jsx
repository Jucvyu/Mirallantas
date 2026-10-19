const SIZES = {
  sm: { badge: 'h-8 w-8 text-xs', text: 'text-base' },
  md: { badge: 'h-9 w-9 text-sm', text: 'text-lg' },
  lg: { badge: 'h-14 w-14 text-lg', text: 'text-2xl' },
};

export default function Logo({ size = 'md', initials = 'ML', suffix = '', className = '' }) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl bg-amber-400 font-bold text-slate-900 ${s.badge}`}
      >
        {initials}
      </span>
      <span className={`font-bold text-amber-400 ${s.text}`}>
        MiraLlantas
        {suffix && <span className="text-slate-900 dark:text-white"> {suffix}</span>}
      </span>
    </div>
  );
}
