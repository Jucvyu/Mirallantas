import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { LoaderCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
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
 *
 * Minimalista: el recuadro de Cloudflare solo aparece si hace falta que la
 * persona interactúe ("interaction-only"); el resto del tiempo se ve una
 * línea discreta con el estado de la verificación.
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
  // 'verificando' | 'lista' | 'interaccion' (Cloudflare pide un clic) | 'fallo'
  const [estado, setEstado] = useState('verificando');
  const { theme } = useTheme();

  useImperativeHandle(ref, () => ({
    reiniciar() {
      alCambiar.current('');
      setEstado('verificando');
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
          appearance: 'interaction-only',
          // Los avisos de un captcha ya retirado (p. ej. al cambiar el tema) se ignoran
          callback: (token) => {
            if (!vigente) return;
            setEstado('lista');
            alCambiar.current(token);
          },
          'before-interactive-callback': () => vigente && setEstado('interaccion'),
          'expired-callback': () => {
            if (!vigente) return;
            // Venció sin usarse: se vuelve a verificar sola
            setEstado('verificando');
            alCambiar.current('');
            window.turnstile?.reset(widget.current);
          },
          'error-callback': () => {
            if (!vigente) return;
            setEstado('fallo');
            alCambiar.current('');
          },
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

  const linea = {
    verificando: [LoaderCircle, 'Verificando que eres una persona…', 'text-slate-400 dark:text-slate-500', 'animate-spin'],
    lista: [ShieldCheck, 'Verificación de seguridad completada', 'text-emerald-600 dark:text-emerald-400', ''],
    interaccion: [ShieldCheck, 'Confirma que eres una persona', 'text-amber-600 dark:text-amber-400', ''],
    fallo: [ShieldAlert, 'No se pudo verificar. Recarga la página e inténtalo de nuevo.', 'text-red-500', ''],
  };
  const [Icono, texto, color, giro] = error ? linea.fallo : linea[estado];

  return (
    <div>
      {/* Solo ocupa espacio cuando Cloudflare pide interactuar */}
      <div ref={contenedor} className={estado === 'interaccion' ? 'mb-1.5 w-full' : 'h-0 w-full overflow-hidden'} />
      <p className={`flex items-center justify-center gap-1.5 text-[11px] font-medium ${color}`} aria-live="polite">
        <Icono size={13} className={`shrink-0 ${giro}`} />
        {error || texto}
      </p>
    </div>
  );
}
