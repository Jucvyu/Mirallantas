import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../../config';

const URL_SCRIPT = 'https://accounts.google.com/gsi/client';

/** Carga el script de Google una sola vez, aunque el botón se monte varias veces. */
let cargandoScript = null;
function cargarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  cargandoScript ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = resolver;
    script.onerror = () => {
      cargandoScript = null;
      rechazar(new Error('No se pudo cargar Google.'));
    };
    document.head.appendChild(script);
  });
  return cargandoScript;
}

/** Logo "G" de Google, con sus cuatro colores. */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Botón "Continuar con Google" con el diseño del login.
 *
 * El botón oficial de Google es un iframe que no se puede estilizar: se
 * dibuja invisible encima de nuestro botón y es el que recibe el clic (y el
 * foco del teclado). Google abre su ventana, el usuario elige su cuenta y
 * devuelve un token que se entrega a `onCredencial`; la API lo verifica. Si
 * no hay VITE_GOOGLE_CLIENT_ID, el botón no aparece.
 */
export default function BotonGoogle({ onCredencial, deshabilitado = false }) {
  const contenedor = useRef(null);
  // Siempre la función más reciente, sin volver a pintar el botón de Google
  const alResponder = useRef(onCredencial);
  useEffect(() => {
    alResponder.current = onCredencial;
  });
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let vigente = true;
    cargarScriptGoogle()
      .then(() => {
        if (!vigente || !contenedor.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (respuesta) => alResponder.current(respuesta.credential),
          ux_mode: 'popup',
          // Sin la ventanita automática de "One Tap": solo cuando se pulsa el botón
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        // Invisible y del ancho máximo que admite Google (400 px): recortado
        // al tamaño del nuestro, lo cubre entero y todo él recibe el clic
        window.google.accounts.id.renderButton(contenedor.current, {
          type: 'standard',
          size: 'large',
          text: 'continue_with',
          locale: 'es',
          width: 400,
        });
        setListo(true);
      })
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400 dark:text-slate-500">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-300 dark:to-white/15" />
        o continúa con
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-300 dark:to-white/15" />
      </div>

      {/* Mientras se procesa un inicio, el botón no responde */}
      <div className={`group relative h-11 w-full ${deshabilitado || !listo ? 'pointer-events-none opacity-60' : ''}`}>
        {/* Lo que se ve */}
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center gap-2.5 rounded-[14px] border border-slate-200 bg-white/80 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition-[border-color,background-color,box-shadow,transform] duration-200 group-hover:border-amber-400 group-hover:bg-white group-hover:shadow-md group-hover:shadow-amber-400/10 group-focus-within:border-amber-400 group-focus-within:ring-2 group-focus-within:ring-amber-400/40 group-active:scale-[0.97] dark:border-white/10 dark:bg-brand-navy-800/80 dark:text-slate-100 dark:group-hover:border-amber-400/70 dark:group-hover:bg-brand-navy-700"
        >
          <LogoGoogle />
          Continuar con Google
        </div>
        {/* El botón real de Google, invisible encima */}
        <div
          ref={contenedor}
          className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.01] [&>div]:scale-y-125"
        />
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
