import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../../components/base/Logo';
import ThemeToggle from '../../components/base/ThemeToggle';
import { SECCIONES } from './contenido';

/**
 * Menú del landing: barra de vidrio flotante y fija arriba, con anclas a
 * cada sección, el selector de tema (el mismo de siempre) y "Acceder".
 * En pantallas pequeñas las anclas pasan a un menú desplegable.
 */
export default function LandingNavbar() {
  const [abierto, setAbierto] = useState(false);

  // El menú móvil se cierra con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
      <div className="ml-glass mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 sm:px-5">
        {/* En móvil queda solo el icono del logo para que la barra quepa en 360 px */}
        <a href="#inicio" className="shrink-0 rounded-xl max-sm:[&_span]:hidden" aria-label="Mirallantas, ir al inicio">
          <Logo size="sm" />
        </a>

        <nav aria-label="Secciones" className="hidden items-center gap-1 lg:flex">
          {SECCIONES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white/60 hover:text-brand-blue dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="ml-pulsable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
          >
            Acceder <ArrowRight size={15} aria-hidden="true" className="hidden sm:block" />
          </Link>
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            aria-controls="menu-landing"
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="ml-pulsable inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10 lg:hidden"
          >
            {abierto ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      {abierto && (
        <nav
          id="menu-landing"
          aria-label="Secciones"
          className="ml-glass ml-aparece mx-auto mt-2 max-w-7xl rounded-2xl border p-2 lg:hidden"
        >
          {SECCIONES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setAbierto(false)}
              className="block rounded-xl px-4 py-3 text-base font-semibold text-slate-800 hover:bg-white/60 dark:text-slate-100 dark:hover:bg-white/10"
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
