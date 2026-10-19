import { ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section>
      <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:px-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-brand-navy-900 px-4 py-1.5 text-xs font-semibold text-amber-400 dark:bg-white/5">
          Sistema ERP especializado en llantas <Zap size={12} />
        </span>

        <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
          Gestiona tu negocio
          <br />
          <span className="text-amber-400">de llantas</span> con poder
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-500 dark:text-slate-400 sm:text-lg">
          MiraLlantas es la plataforma ERP completa para distribuidoras y talleres de llantas.
          Pedidos, reencauche, créditos, entregas, inventario y más — todo integrado.
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-300"
          >
            Probar ahora — es gratis <ArrowRight size={16} />
          </Link>
        </div>
      </div>

    </section>
  );
}
