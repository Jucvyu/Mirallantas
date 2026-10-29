import Logo from './Logo';

/** Colores del símbolo según el tipo de aviso. */
const TONOS = {
  rojo: { fondo: 'bg-red-500/10', medio: 'bg-red-500/15', icono: 'text-red-500 dark:text-red-400' },
  ambar: { fondo: 'bg-amber-400/10', medio: 'bg-amber-400/20', icono: 'text-amber-500 dark:text-amber-400' },
  azul: { fondo: 'bg-blue-500/10', medio: 'bg-blue-500/15', icono: 'text-blue-500 dark:text-blue-400' },
};

/** Botones de las pantallas de estado (mismo estilo que Acceso denegado). */
export const BOTON_SECUNDARIO =
  'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200 dark:hover:bg-brand-navy-700';
export const BOTON_PRINCIPAL =
  'inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-400/30 hover:bg-amber-300 disabled:opacity-60';

/**
 * Pantalla completa para avisar un estado de la aplicación: sin internet,
 * servidor caído, error inesperado, página no encontrada… Mismo diseño que
 * "Acceso denegado": logo, símbolo, código, título, mensaje y salidas.
 *
 *   <PantallaEstado icono={WifiOff} tono="ambar" codigo="Sin conexión" titulo="…" mensaje="…">
 *     <button className={BOTON_PRINCIPAL}>Reintentar</button>
 *   </PantallaEstado>
 *
 * `superpuesta` la pone encima de todo (para avisos que llegan mientras se
 * usa la aplicación, sin perder lo que había debajo). `compacta` la muestra
 * dentro del panel o del portal (sin logo ni alto de pantalla completa).
 */
export default function PantallaEstado({
  icono: Icono,
  tono = 'rojo',
  codigo,
  titulo,
  mensaje,
  children,
  superpuesta = false,
  compacta = false,
  detalle,
}) {
  const color = TONOS[tono] ?? TONOS.rojo;
  return (
    <div
      role={superpuesta ? 'alertdialog' : undefined}
      aria-modal={superpuesta || undefined}
      aria-labelledby="pantalla-estado-titulo"
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compacta ? 'py-12' : 'min-h-screen bg-slate-50 py-16 dark:bg-brand-navy-900'
      } ${superpuesta ? 'fixed inset-0 z-[200] overflow-y-auto' : ''}`}
    >
      {!compacta && <Logo size="md" />}

      {/* ---- Símbolo ---- */}
      <div className={`relative ${compacta ? '' : 'mt-12'} flex h-24 w-24 items-center justify-center`}>
        <span className={`absolute inset-0 rounded-full ${color.fondo}`} />
        <span className={`absolute inset-3 rounded-full ${color.medio}`} />
        <Icono size={34} strokeWidth={1.5} className={`relative ${color.icono}`} />
      </div>

      {/* ---- Mensaje ---- */}
      {codigo && (
        <p className="mt-8 font-mono text-5xl font-extrabold tabular-nums text-slate-200 dark:text-white/10">{codigo}</p>
      )}
      <h1 id="pantalla-estado-titulo" className={`${codigo ? 'mt-2' : 'mt-8'} text-2xl font-bold text-slate-900 dark:text-white`}>
        {titulo}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">{mensaje}</p>

      {/* ---- Salidas ---- */}
      {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>}

      {detalle}
    </div>
  );
}
