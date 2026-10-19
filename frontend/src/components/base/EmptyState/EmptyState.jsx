import * as Icons from 'lucide-react';

export default function EmptyState({ icon = 'Inbox', title, description }) {
  const Icon = Icons[icon] ?? Icons.Inbox;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon size={30} strokeWidth={1.5} className="text-slate-300 dark:text-slate-600" />
      <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400 dark:text-slate-600">{description}</p>}
    </div>
  );
}
