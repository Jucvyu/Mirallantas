import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '../../config';
import { useTheme } from '../../context/ThemeContext';

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Carga el script de Cloudflare una sola vez. */
let cargandoScript = null;
function cargarScript() {
  if (window.turnstile) return Promise.resolve();
  cargandoScript ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = resolver;
    script.onerror = () => {
      cargandoScript = null;
      rechazar(new Error('No se pudo cargar la verificación de seguridad. Revisa tu conexión y recarga la página.'));
    };
    document.head.appendChild(script);
  });
  return cargandoScript;
}

/**
 * Captcha del inicio de sesión (Cloudflare Turnstile).
 *
 * Al superar la prueba entrega su token a `onToken`; si vence o falla,
 * entrega ''. El token sirve una sola vez: después de cada intento de
 * inicio de sesión se llama a `ref.current.reiniciar()` para pedir otro.
 * Sin VITE_TURNSTILE_SITE_KEY no se muestra (la API tampoco lo exige).
 */
export default function Captcha({ onToken, ref }) {
  const contenedor = useRef(null);
  const widget = useRef(null);
  // Siempre la función más reciente, sin volver a dibujar el captcha
  const alCambiar = useRef(onToken);
  useEffect(() => {
    alCambiar.current = onToken;
  });
  const [error, setError] = useState('');
  const { theme } = useTheme();

  useImperativeHandle(ref, () => ({
    reiniciar() {
      alCambiar.current('');
      if (widget.current !== null) window.turnstile?.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;
    let vigente = true;
    cargarScript()
      .then(() => {
        if (!vigente || !contenedor.current) return;
        widget.current = window.turnstile.render(contenedor.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: theme === 'dark' ? 'dark' : 'light',
          language: 'es',
          size: 'flexible',
          callback: (token) => alCambiar.current(token),
          'expired-callback': () => alCambiar.current(''),
          'error-callback': () => alCambiar.current(''),
        });
      })
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
      alCambiar.current('');
    };
  }, [theme]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div>
      <div ref={contenedor} className="min-h-[65px] w-full" />
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
