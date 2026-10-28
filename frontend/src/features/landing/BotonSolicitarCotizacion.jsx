import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import AvisoError from '../../components/base/AvisoError';
import Modal from '../../components/base/Modal';
import { TURNSTILE_SITE_KEY } from '../../config';
import { authService } from '../../services';
import { enlaceWhatsapp } from './contenido';
import Captcha from '../auth/Captcha';

/**
 * "Solicitar cotización" de la página de inicio.
 *
 * Antes de abrir WhatsApp se pasa la verificación de seguridad (Cloudflare):
 * el botón abre un modal con el captcha, la API lo comprueba y solo entonces
 * aparece el botón para continuar en WhatsApp. Sin captcha configurado
 * (VITE_TURNSTILE_SITE_KEY), el botón abre WhatsApp directamente.
 *
 *   <BotonSolicitarCotizacion className="…">Solicitar cotización</BotonSolicitarCotizacion>
 */
export default function BotonSolicitarCotizacion({ className, children }) {
  const [abierto, setAbierto] = useState(false);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <a href={enlaceWhatsapp()} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className}>
        {children}
      </button>
      {abierto && <VerificarYContinuar onClose={() => setAbierto(false)} />}
    </>
  );
}

function VerificarYContinuar({ onClose }) {
  const [captcha, setCaptcha] = useState('');
  const [estado, setEstado] = useState('verificando'); // 'verificando' | 'aprobado'
  const [error, setError] = useState('');
  const captchaRef = useRef(null);

  // Con el token del navegador, la API lo comprueba con Cloudflare
  useEffect(() => {
    if (!captcha) return undefined;
    let vigente = true;
    authService
      .verificarCaptcha(captcha)
      .then(() => vigente && setEstado('aprobado'))
      .catch((e) => {
        if (!vigente) return;
        setError(e.message);
        captchaRef.current?.reiniciar();
      });
    return () => {
      vigente = false;
    };
  }, [captcha]);

  return (
    <Modal
      title="Solicitar cotización"
      subtitle="Antes de continuar en WhatsApp, verificamos que eres una persona."
      icon={<ShieldCheck size={17} />}
      size="sm"
      onClose={onClose}
      footer={(cerrar) => (
        <>
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-brand-navy-800 dark:text-slate-200"
          >
            Cancelar
          </button>
          {estado === 'aprobado' ? (
            <a
              href={enlaceWhatsapp()}
              target="_blank"
              rel="noreferrer"
              onClick={cerrar}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300"
            >
              <FaWhatsapp size={16} aria-hidden="true" /> Continuar en WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex cursor-wait items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 opacity-50"
            >
              <FaWhatsapp size={16} aria-hidden="true" /> Continuar en WhatsApp
            </button>
          )}
        </>
      )}
    >
      <div className="space-y-3">
        <AvisoError mensaje={error} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Escríbenos la medida o el servicio que necesitas y te respondemos con tu cotización.
        </p>
        <Captcha
          ref={captchaRef}
          onToken={(token) => {
            setError('');
            setEstado('verificando');
            setCaptcha(token);
          }}
        />
      </div>
    </Modal>
  );
}
