const STATUS_STYLES = {
  // Verdes — completado / aprobado / al día
  Aprobado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Entregado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Completado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Recibida: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Confirmado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'Al día': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Disponible: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Pagado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Apta: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Aprobada: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Completada: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Activo: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  // Ámbar — pendiente / en proceso
  Pendiente: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'En proceso': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'En tránsito': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'En camino': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'Por entregar': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'Pendiente de revisión': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Contado: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Crédito: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  // Rojo — rechazado / vencido
  Rechazado: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Vencido: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Cancelado: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Rechazada: 'bg-red-500/15 text-red-600 dark:text-red-400',
  'No apta': 'bg-red-500/15 text-red-600 dark:text-red-400',
  Agotado: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Anulada: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Inactivo: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  // Azul — informativo / neutral
  Neutral: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

/** Clases de color del estado, para reutilizarlas fuera del Badge. */
export function statusClass(value) {
  return STATUS_STYLES[value] ?? 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
}

export default function Badge({ children, tone }) {
  const className = statusClass(tone ?? children);
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
