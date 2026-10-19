import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CTA() {
  return (
    <section id="contacto" className="bg-brand-navy-950 py-20">
      <div className="mx-auto max-w-2xl px-6 text-center sm:px-10">
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">¿Listo para empezar?</h2>
        <p className="mt-3 text-slate-400">Prueba MiraLlantas hoy y transforma la gestión de tu negocio</p>
        <Link
          to="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-7 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-300"
        >
          Comenzar ahora <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
