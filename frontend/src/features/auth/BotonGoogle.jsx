import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../../config';
import { useTheme } from '../../context/ThemeContext';

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

/**
 * Botón oficial "Continuar con Google".
 *
 * Google abre su ventana, el usuario elige su cuenta y devuelve un token que
 * se entrega a `onCredencial`; la API lo verifica. Si no hay
 * VITE_GOOGLE_CLIENT_ID, el botón no aparece.
 */
export default function BotonGoogle({ onCredencial, deshabilitado = false }) {
  const contenedor = useRef(null);
  // Siempre la función más reciente, sin volver a pintar el botón de Google
  const alResponder = useRef(onCredencial);
  useEffect(() => {
    alResponder.current = onCredencial;
  });
  const [error, setError] = useState('');
  const { theme } = useTheme();

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
        window.google.accounts.id.renderButton(contenedor.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          locale: 'es',
          width: contenedor.current.offsetWidth || 320,
        });
      })
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [theme]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />o<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>
      {/* Mientras se procesa un inicio, el botón no responde */}
      <div ref={contenedor} className={`flex min-h-[44px] w-full justify-center ${deshabilitado ? 'pointer-events-none opacity-60' : ''}`} />
      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
