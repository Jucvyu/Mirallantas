import { useEffect, useRef, useState } from 'react';
import { Pencil, ShieldCheck, X } from 'lucide-react';

/**
 * Avatar del usuario con el detalle del perfil en un desplegable.
 *
 * Al pulsar la foto no se abre un modal: se despliega una tarjeta anclada
 * al avatar con el detalle inicial (los datos de la ficha) y dos botones,
 * "Editar" —que sí abre el formulario— y "Cerrar". Lo comparten el topbar
 * del administrador y el navbar del cliente para que las dos vistas se
 * comporten igual.
 *
 * props:
 *   profile   ficha del usuario (nombre, foto, rol...)
 *   campos    [{ label, value }] que se listan en el detalle
 *   onEditar    abre el formulario de edición
 *   onSeguridad abre la verificación en dos pasos
 */
export default function PerfilMenu({ profile, campos = [], onEditar, onSeguridad }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  // Se cierra al hacer click fuera o con Escape, como el resto de los
  // desplegables de la app.
  useEffect(() => {
    if (!abierto) return undefined;
    const alClickFuera = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', alClickFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const iniciales = profile.nombre
    .split(' ')
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join('')
    .toUpperCase();

  const avatar = profile.foto ? (
    <img src={profile.foto} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">
      {iniciales}
    </span>
  );

  return (
    <div ref={contenedor} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
        title="Ver mi perfil"
      >
        {avatar}
        <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {profile.nombre}
        </span>
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-xl ml-glass-panel border">
          {/* ---- Cabecera: quién es ---- */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-white/10">
            {profile.foto ? (
              <img src={profile.foto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-slate-900">
                {iniciales}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile.nombre}</p>
              {profile.rol && (
                <p className="truncate text-xs text-amber-600 dark:text-amber-400">{profile.rol}</p>
              )}
            </div>
          </div>

          {/* ---- Detalle inicial de la ficha ---- */}
          <dl className="space-y-2.5 px-4 py-3.5">
            {campos.map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {label}
                </dt>
                <dd className="min-w-0 truncate text-right text-xs font-medium text-slate-700 dark:text-slate-200">
                  {value || '—'}
                </dd>
              </div>
            ))}
          </dl>

          {/* ---- Seguridad de la cuenta ---- */}
          {onSeguridad && (
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                onSeguridad();
              }}
              className="flex w-full items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-amber-500" /> Verificación en dos pasos
              </span>
              <span className={profile.dosFactores ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                {profile.dosFactores ? 'Activa' : 'Inactiva'}
              </span>
            </button>
          )}

          {/* ---- Acciones ---- */}
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/10">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <X size={13} /> Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                onEditar?.();
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-amber-300"
            >
              <Pencil size={13} /> Editar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
