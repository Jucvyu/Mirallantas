import { House } from 'lucide-react';

export default function PageHeader({ crumbs }) {
  return (
    <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      <House size={13} />
      {crumbs.map((crumb, i) => (
        <span key={crumb} className="flex items-center gap-1.5">
          <span>›</span>
          <span
            className={
              i === crumbs.length - 1
                ? 'font-medium text-slate-600 dark:text-slate-300'
                : 'text-slate-400 dark:text-slate-500'
            }
          >
            {crumb}
          </span>
        </span>
      ))}
    </nav>
  );
}
