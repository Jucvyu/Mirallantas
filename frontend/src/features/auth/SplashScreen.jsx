import { useEffect } from 'react';
import Logo from '../../components/base/Logo';
import TruckTire from '../../components/base/TruckTire';

/**
 * Pantalla de carga que se muestra justo después de iniciar sesión.
 *
 * Cubre el salto entre el formulario y el panel: la llanta gira mientras la
 * barra se llena y, al terminar, llama a `onFinish` para navegar. Solo
 * aparece en el acceso, no al moverse por la aplicación.
 */
export default function SplashScreen({ nombre = '', onFinish, duracion = 1600 }) {
  useEffect(() => {
    const id = setTimeout(() => onFinish?.(), duracion);
    return () => clearTimeout(id);
  }, [onFinish, duracion]);

  return (
    <div className="ml-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-brand-navy-950">
      <Logo size="md" />

      <TruckTire className="ml-splash-tire h-28 w-28 drop-shadow-2xl" />

      <div className="w-56">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <span
            className="ml-splash-bar block h-full rounded-full bg-amber-400"
            style={{ animationDuration: `${duracion}ms` }}
          />
        </div>
        <p className="mt-3 text-center text-xs font-medium tracking-wide text-slate-400">
          {nombre ? `Preparando tu panel, ${nombre}...` : 'Preparando tu panel...'}
        </p>
      </div>
    </div>
  );
}
