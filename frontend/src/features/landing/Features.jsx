import { Activity, ShieldCheck, Star } from 'lucide-react';

const FEATURES = [
  {
    icon: Star,
    title: 'Fácil de usar',
    text: 'Interfaz industrial diseñada para equipos de ventas, bodega y contabilidad. Sin curva de aprendizaje.',
  },
  {
    icon: ShieldCheck,
    title: 'Seguro por diseño',
    text: 'Roles y permisos granulares. Cada usuario ve solo lo que necesita.',
  },
  {
    icon: Activity,
    title: 'Datos en tiempo real',
    text: 'Dashboards actualizados con KPIs financieros y operativos para decisiones rápidas.',
  },
];

export default function Features() {
  return (
    <section id="caracteristicas" className="border-t border-slate-200 bg-white py-16 dark:border-white/10 dark:bg-brand-navy-950">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:grid-cols-3 sm:px-10">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
              <Icon size={20} strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
