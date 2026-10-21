import { useState } from 'react';
import { KeyRound, MailCheck } from 'lucide-react';
import AvisoError from '../../components/base/AvisoError';
import Modal from '../../components/base/Modal';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from '../../components/base/formStyles';
import { useEnvio } from '../../hooks/useEnvio';
import { authService } from '../../services';

// =========================================================================
// "¿Olvidaste tu contraseña?": el usuario escribe su correo y la API le
// envía un enlace de un solo uso para crear una contraseña nueva (vence en
// 30 minutos). La respuesta es la misma exista o no la cuenta: así nadie
// puede averiguar qué correos están registrados. Por eso aquí se dice "si
// el correo está registrado", nunca "te enviamos el correo".
// =========================================================================

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const BOTON =
  'rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50';

export default function RecuperarPasswordModal({ onClose }) {
  const [correo, setCorreo] = useState('');
  const [tocado, setTocado] = useState(false);
  // Mensaje genérico de la API cuando la solicitud se procesó
  const [respuesta, setRespuesta] = useState('');
  const { enviando, errorEnvio, enviar } = useEnvio();

  const correoLimpio = correo.trim();
  const error = !correoLimpio
    ? 'Escribe el correo de tu cuenta'
    : !CORREO_VALIDO.test(correoLimpio)
      ? 'Escribe un correo válido, por ejemplo nombre@correo.com'
      : '';

  const solicitar = () => {
    setTocado(true);
    if (error) return;
    enviar(async () => {
      const { mensaje } = await authService.solicitarRecuperacion(correoLimpio);
      setRespuesta(mensaje);
    });
  };

  return (
    <Modal
      title="Recuperar la contraseña"
      subtitle={respuesta ? 'Revisa tu correo' : 'Te enviaremos un enlace para crear una nueva.'}
      icon={respuesta ? <MailCheck size={17} /> : <KeyRound size={17} />}
      size="sm"
      onClose={onClose}
      footer={(cerrar) =>
        respuesta ? (
          <button type="button" onClick={cerrar} className={BOTON}>
            Entendido
          </button>
        ) : (
          <button type="button" onClick={solicitar} disabled={enviando} className={BOTON}>
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </button>
        )
      }
    >
      {respuesta ? (
        <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <p>{respuesta}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            El enlace vence en 30 minutos y solo se puede usar una vez. Si no llega, vuelve a solicitarlo.
          </p>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            solicitar();
          }}
        >
          <AvisoError mensaje={errorEnvio} />
          <div>
            <label htmlFor="rec-correo" className={LABEL}>
              Correo electrónico <span className="text-red-500">*</span>
            </label>
            <input
              id="rec-correo"
              type="email"
              autoComplete="email"
              autoFocus
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              onBlur={() => setTocado(true)}
              placeholder="nombre@correo.com"
              className={`${INPUT} ${tocado && error ? BORDER_ERR : BORDER_OK}`}
            />
            {tocado && error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
          </div>
        </form>
      )}
    </Modal>
  );
}
