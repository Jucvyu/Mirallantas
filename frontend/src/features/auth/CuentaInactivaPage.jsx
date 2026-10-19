import { Home, LogIn, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../../components/base/Logo';

/**
 * Pantalla de cuenta inactiva.
 *
 * Aparece cuando alguien inicia sesión con la contraseña correcta pero su
 * cuenta (o su rol, o su ficha de cliente) está inactiva, y también si lo
 * desactivan mientras tiene la sesión abierta. Solo un administrador puede
 * volver a activarla.
 */
export default function CuentaInactivaPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center dark:bg-brand-navy-900">
      <Logo size="md" />

      {/* ---- Símbolo ---- */}
      <div className="relative mt-12 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-amber-400/10" />
        <span className="absolute inset-3 rounded-full bg-amber-400/15" />
        <UserX size={34} strokeWidth={1.5} className="relative text-amber-500" />
      </div>

      {/* ---- Mensaje ---- */}
      <h1 className="mt-8 text-2xl font-bold text-slate-900 dark:text-white">Tu cuenta está inactiva</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Por ahora no puedes ingresar al sistema. Pide al administrador de MiraLlantas que te vuelva a
        activar; cuando lo haga, podrás iniciar sesión con tu misma contraseña.
      </p>

      {/* ---- Salidas ---- */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          <Home size={16} /> Ir al inicio
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300"
        >
          <LogIn size={16} /> Entrar con otra cuenta
        </Link>
      </div>
    </div>
  );
}
