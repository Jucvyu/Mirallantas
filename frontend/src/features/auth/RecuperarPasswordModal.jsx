import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, KeyRound, Lock, TriangleAlert } from 'lucide-react';
import Modal from '../../components/base/Modal';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from '../../components/base/formStyles';
import { useEnvio } from '../../hooks/useEnvio';
import { authService } from '../../services';
import Captcha from './Captcha';
import { CampoCodigo } from './DosFactores';
import { TURNSTILE_SITE_KEY } from '../../config';
import { AYUDA_PASSWORD, errorPassword } from './reglasClave';

// =========================================================================
// "¿Olvidaste tu contraseña?" en tres pasos:
//   1. correo   → la API busca la cuenta y envía un código de 6 dígitos.
//                 Cada solicitud gasta un intento, exista o no el correo
//                 (5 en total); al agotarlos el modal se bloquea 1 minuto
//                 con un contador y luego se recuperan los 5.
//   2. código   → 3 intentos; si se agotan, también se bloquea.
//   3. contraseña nueva.
// Los intentos los cuenta la API: cerrar el modal o recargar no los reinicia.
// =========================================================================

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 125 → "2:05" */
const reloj = (segundos) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

/** Aviso amarillo (intentos restantes, código enviado…). */
function Aviso({ children, tono = 'amber' }) {
  const colores =
    tono === 'red'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
      : 'bg-amber-400/15 text-amber-700 dark:text-amber-300';
  return (
    <p className={`ml-aparece flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium ${colores}`}>
      <TriangleAlert size={14} className="mt-px shrink-0" /> <span>{children}</span>
    </p>
  );
}

const BOTON =
  'rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50';

export default function RecuperarPasswordModal({ onClose }) {
  const [paso, setPaso] = useState('correo');
  // Captcha: sin aprobarlo no se envía el código (cada envío usa un token nuevo)
  const [captcha, setCaptcha] = useState('');
  const captchaRef = useRef(null);
  const faltaCaptcha = Boolean(TURNSTILE_SITE_KEY) && !captcha;
  const [correo, setCorreo] = useState('');
  const [solicitud, setSolicitud] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errorCampo, setErrorCampo] = useState('');
  // Aviso con los intentos que quedan (correo o código)
  const [aviso, setAviso] = useState('');
  // Segundos de bloqueo que faltan (0 = sin bloqueo)
  const [segundos, setSegundos] = useState(0);
  const { enviando, errorEnvio, setErrorEnvio, enviar } = useEnvio();

  /** Lee de un error de la API si quedó bloqueado. */
  const revisarBloqueo = useCallback((datos) => {
    if (datos?.segundosRestantes) {
      setSegundos(datos.segundosRestantes);
      setAviso('');
      return true;
    }
    return false;
  }, []);

  // Al abrir: ¿este equipo está bloqueado?
  useEffect(() => {
    authService
      .estadoRecuperacion()
      .then(revisarBloqueo)
      .catch(() => {});
  }, [revisarBloqueo]);

  // Contador del bloqueo: baja cada segundo; al llegar a cero se desbloquea
  // y se vuelve a empezar desde el correo.
  useEffect(() => {
    if (segundos <= 0) return undefined;
    const id = setTimeout(() => {
      if (segundos === 1) {
        setPaso('correo');
        setSolicitud(null);
        setCodigo('');
        setErrorEnvio('');
      }
      setSegundos((s) => s - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [segundos, setErrorEnvio]);

  const bloqueado = segundos > 0;

  // ---- Paso 1: correo -------------------------------------------------------
  const enviarCorreo = () => {
    if (!CORREO_VALIDO.test(correo.trim())) {
      setErrorCampo('Escribe un correo válido, por ejemplo nombre@correo.com');
      return;
    }
    if (faltaCaptcha) return;
    setErrorCampo('');
    setAviso('');
    enviar(async () => {
      try {
        const r = await authService.solicitarRecuperacion(correo, captcha);
        setSolicitud(r);
        setCodigo('');
        setPaso('codigo');
      } catch (error) {
        if (revisarBloqueo(error.datos)) return;
        // Correo inexistente: el mensaje ya dice cuántos intentos quedan
        if (error.estado === 404) {
          setAviso(error.message);
          return;
        }
        throw error;
      } finally {
        captchaRef.current?.reiniciar();
      }
    });
  };

  // ---- Paso 2: código -------------------------------------------------------
  const enviarCodigo = () => {
    setAviso('');
    enviar(async () => {
      try {
        await authService.verificarCodigoRecuperacion(solicitud.solicitud, codigo);
        setPaso('password');
      } catch (error) {
        if (revisarBloqueo(error.datos)) return;
        if (error.estado === 422) {
          setAviso(error.message);
          setCodigo('');
          return;
        }
        // 410: el código venció → se vuelve a pedir el correo
        if (error.estado === 410) setPaso('correo');
        throw error;
      }
    });
  };

  // ---- Paso 3: contraseña nueva -------------------------------------------------
  const guardarPassword = () => {
    const problema = errorPassword(password) || (password !== password2 ? 'Las contraseñas no coinciden.' : '');
    setErrorCampo(problema);
    if (problema) return;
    enviar(async () => {
      try {
        await authService.cambiarPasswordRecuperada(solicitud.solicitud, password);
        setPaso('listo');
      } catch (error) {
        if (error.estado === 410) setPaso('correo');
        throw error;
      }
    });
  };

  // ---- Botón del pie según el paso ------------------------------------------------
  const pie = (cerrar) => {
    if (bloqueado) return null;
    if (paso === 'listo') {
      return (
        <button type="button" onClick={cerrar} className={BOTON}>
          Iniciar sesión
        </button>
      );
    }
    const acciones = {
      correo: ['Enviar código', enviarCorreo, !correo.trim() || faltaCaptcha],
      codigo: ['Verificar código', enviarCodigo, codigo.length !== 6],
      password: ['Guardar contraseña', guardarPassword, !password || !password2],
    };
    const [texto, accion, incompleto] = acciones[paso];
    return (
      <button type="button" onClick={accion} disabled={enviando || incompleto} className={BOTON}>
        {enviando ? 'Un momento…' : texto}
      </button>
    );
  };

  return (
    <Modal
      title="¿Olvidaste tu contraseña?"
      subtitle="Te ayudamos a recuperar el acceso a tu cuenta."
      icon={<KeyRound size={17} />}
      size="md"
      onClose={onClose}
      footer={pie}
    >
      <div className="space-y-4">
        {errorEnvio && !bloqueado && <Aviso tono="red">{errorEnvio}</Aviso>}

        {bloqueado ? (
          // ---- Vista bloqueada con el contador ----
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Lock size={22} />
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Agotaste los intentos permitidos
            </p>
            <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
              Por seguridad, debes esperar antes de volver a intentarlo.
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums text-amber-500" aria-live="polite">
              {reloj(segundos)}
            </p>
          </div>
        ) : paso === 'correo' ? (
          // ---- Paso 1 ----
          <>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Escribe el correo de tu cuenta. Si está registrado, te enviaremos un código de verificación.
            </p>
            <div>
              <label htmlFor="rec-correo" className={LABEL}>
                Correo electrónico
              </label>
              <input
                id="rec-correo"
                type="email"
                maxLength={80}
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  // Validación en tiempo real del formato del correo
                  setErrorCampo(
                    e.target.value && !CORREO_VALIDO.test(e.target.value.trim())
                      ? 'Escribe un correo válido, por ejemplo nombre@correo.com'
                      : '',
                  );
                }}
                onKeyDown={(e) => e.key === 'Enter' && enviarCorreo()}
                autoComplete="email"
                autoFocus
                placeholder="nombre@correo.com"
                className={`${INPUT} ${errorCampo ? BORDER_ERR : BORDER_OK}`}
              />
              {errorCampo && <p className="mt-1.5 text-xs font-medium text-red-500">{errorCampo}</p>}
            </div>
            {/* Verificación de seguridad: obligatoria para enviar el código */}
            <Captcha ref={captchaRef} onToken={setCaptcha} />
            {aviso && <Aviso>{aviso}</Aviso>}
          </>
        ) : paso === 'codigo' ? (
          // ---- Paso 2 ----
          <>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Enviamos un código de 6 dígitos a <strong>{solicitud.correo}</strong>. Vence en 10 minutos y
              tienes {solicitud.intentosCodigo} intentos.
            </p>
            <CampoCodigo id="rec-codigo" valor={codigo} onCambio={setCodigo} autoFocus />
            {aviso && <Aviso>{aviso}</Aviso>}
            <button
              type="button"
              onClick={() => {
                setPaso('correo');
                setAviso('');
                setErrorEnvio('');
              }}
              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-amber-500 hover:underline dark:text-slate-400"
            >
              ¿No te llegó? Solicitar otro código
            </button>
          </>
        ) : paso === 'password' ? (
          // ---- Paso 3 ----
          <>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Código verificado. Escribe tu contraseña nueva.
            </p>
            <div>
              <label htmlFor="rec-pass" className={LABEL}>
                Contraseña nueva
              </label>
              <input
                id="rec-pass"
                type="password"
                maxLength={72}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  // La regla de la contraseña se revisa mientras se escribe
                  setErrorCampo(e.target.value ? errorPassword(e.target.value) : '');
                }}
                autoComplete="new-password"
                autoFocus
                className={`${INPUT} ${errorCampo ? BORDER_ERR : BORDER_OK}`}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{AYUDA_PASSWORD}</p>
            </div>
            <div>
              <label htmlFor="rec-pass2" className={LABEL}>
                Repite la contraseña
              </label>
              <input
                id="rec-pass2"
                type="password"
                maxLength={72}
                value={password2}
                onChange={(e) => {
                  setPassword2(e.target.value);
                  setErrorCampo(
                    errorPassword(password) || (e.target.value && e.target.value !== password ? 'Las contraseñas no coinciden.' : ''),
                  );
                }}
                onKeyDown={(e) => e.key === 'Enter' && guardarPassword()}
                autoComplete="new-password"
                className={`${INPUT} ${errorCampo ? BORDER_ERR : BORDER_OK}`}
              />
              {errorCampo && <p className="mt-1.5 text-xs font-medium text-red-500">{errorCampo}</p>}
            </div>
          </>
        ) : (
          // ---- Listo ----
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Contraseña actualizada</p>
            <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
              Ya puedes iniciar sesión con tu contraseña nueva. Por seguridad, cerramos las sesiones que tenías
              abiertas.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
