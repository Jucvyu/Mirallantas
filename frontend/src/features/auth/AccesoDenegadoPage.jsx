import { ArrowLeft, LockKeyhole, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/base/Logo';

/**
 * Pantalla de acceso denegado (403).
 *
 * Se muestra cuando alguien entra a un módulo para el que su rol no tiene
 * permiso. No es un "no encontrado": la ruta existe, lo que falta es la
 * autorización, así que se ofrece volver atrás o cambiar de cuenta.
 */
export default function AccesoDenegadoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center dark:bg-brand-navy-900">
      <Logo size="md" />

      {/* ---- Símbolo ---- */}
      <div className="relative mt-12 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-red-500/10" />
        <span className="absolute inset-3 rounded-full bg-red-500/15" />
        <LockKeyhole size={34} strokeWidth={1.5} className="relative text-red-500 dark:text-red-400" />
      </div>

      {/* ---- Mensaje ---- */}
      <p className="mt-8 font-mono text-5xl font-extrabold tabular-nums text-slate-200 dark:text-white/10">
        403
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Acceso denegado</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Tu rol no tiene permiso para entrar a este módulo. Si crees que deberías tenerlo, pídele al
        administrador que revise los permisos de tu cuenta.
      </p>

      {/* ---- Salidas ---- */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700"
        >
          <ArrowLeft size={16} /> Volver
        </button>
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
