import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, TriangleAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AvisoError from '../../components/base/AvisoError';
import { SkeletonLineas } from '../../components/base/Skeleton';
import Footer from '../../components/base/Footer';
import PublicNavbar from '../../components/layout/PublicNavbar';
import { BORDER_ERR, BORDER_OK, INPUT, LABEL } from '../../components/base/formStyles';
import { useEnvio } from '../../hooks/useEnvio';
import { authService } from '../../services';
import { AYUDA_PASSWORD, errorPassword } from './reglasClave';

/**
 * Página del enlace de recuperación (/restablecer-contrasena#token=…).
 *
 * El token viene en el fragmento (#): el navegador no lo envía al servidor
 * del frontend ni a otros sitios. Se lee una vez, se borra de la barra de
 * direcciones y se valida con la API antes de mostrar el formulario. Al
 * guardar, la API cierra todas las sesiones de la cuenta.
 */

/** Lee el token del fragmento de la dirección. */
function leerToken() {
  const datos = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return datos.get('token') ?? '';
}

const BOTON =
  'w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Si se abre otro enlace con la página ya abierta (solo cambia lo que va
 * después de #), el formulario se vuelve a montar y lee el token nuevo.
 */
export default function RestablecerContrasenaPage() {
  const { hash } = useLocation();
  return <Restablecer key={hash} />;
}

function Restablecer() {
  const [token] = useState(leerToken);
  // 'validando' → 'listo' | 'invalido' → 'hecho'
  const [estado, setEstado] = useState(token ? 'validando' : 'invalido');
  const [motivo, setMotivo] = useState('El enlace no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [intento, setIntento] = useState(false);
  const { enviando, errorEnvio, enviar } = useEnvio();

  // Se valida el enlace al abrir la página y se quita el token de la barra
  useEffect(() => {
    if (!token) return undefined;
    window.history.replaceState(null, '', window.location.pathname);
    let vigente = true;
    authService
      .validarEnlaceRecuperacion(token)
      .then(() => vigente && setEstado('listo'))
      .catch((e) => {
        if (!vigente) return;
        setMotivo(e.message);
        setEstado('invalido');
      });
    return () => {
      vigente = false;
    };
  }, [token]);

  const errores = {
    password: errorPassword(password) || '',
    repetida: repetida !== password ? 'Las contraseñas no coinciden' : '',
  };

  const guardar = (e) => {
    e.preventDefault();
    setIntento(true);
    if (errores.password || errores.repetida) return;
    enviar(async () => {
      await authService.restablecerPassword(token, password);
      setEstado('hecho');
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-brand-navy-900">
      <PublicNavbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-brand-navy-800 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500">
              <KeyRound size={18} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Crea una contraseña nueva</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">MiraLlantas</p>
            </div>
          </div>

          {estado === 'validando' && (
            <SkeletonLineas lineas={3} />
          )}

          {estado === 'invalido' && (
            <div className="space-y-4">
              <p className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {motivo}
              </p>
              <Link to="/login" className={`${BOTON} block text-center`}>
                Ir al inicio de sesión
              </Link>
            </div>
          )}

          {estado === 'hecho' && (
            <div className="space-y-4">
              <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> Tu contraseña se actualizó. Por seguridad
                cerramos las sesiones abiertas: inicia sesión con la contraseña nueva.
              </p>
              <Link to="/login" className={`${BOTON} block text-center`}>
                Iniciar sesión
              </Link>
            </div>
          )}

          {estado === 'listo' && (
            <form className="space-y-4" onSubmit={guardar} noValidate>
              <AvisoError mensaje={errorEnvio} />
              <div>
                <label htmlFor="rp-password" className={LABEL}>
                  Contraseña nueva <span className="text-red-500">*</span>
                </label>
                <input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${INPUT} ${intento && errores.password ? BORDER_ERR : BORDER_OK}`}
                />
                <p className={`mt-1 text-xs ${intento && errores.password ? 'font-medium text-red-500' : 'text-slate-400'}`}>
                  {(intento && errores.password) || AYUDA_PASSWORD}
                </p>
              </div>
              <div>
                <label htmlFor="rp-repetida" className={LABEL}>
                  Repite la contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  id="rp-repetida"
                  type="password"
                  autoComplete="new-password"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                  className={`${INPUT} ${intento && errores.repetida ? BORDER_ERR : BORDER_OK}`}
                />
                {intento && errores.repetida && <p className="mt-1 text-xs font-medium text-red-500">{errores.repetida}</p>}
              </div>
              <button type="submit" disabled={enviando} className={BOTON}>
                {enviando ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
