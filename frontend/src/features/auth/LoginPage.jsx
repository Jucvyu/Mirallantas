import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AvisoError from '../../components/base/AvisoError';
import LiquidGlass from '../../components/base/LiquidGlass';
import Logo from '../../components/base/Logo';
import FormModal from '../../components/base/FormModal';
import { BORDER_ERR, BORDER_OK, INPUT } from '../../components/base/formStyles';
import TruckTire from '../../components/base/TruckTire';
import { TURNSTILE_SITE_KEY } from '../../config';
import { tiposDocumento } from '../../constantes';
import { useAuth } from '../../context/AuthContext';
import { pantallaInicial, puedeAbrir } from '../../permisos';
import { CODIGO_CUENTA_INACTIVA } from '../../services';
import { useValidacion } from '../../hooks/useValidacion';
import BotonGoogle from './BotonGoogle';
import Captcha from './Captcha';
import { CampoCodigo } from './DosFactores';
import { AYUDA_PASSWORD, errorPassword } from './reglasClave';
import RecuperarPasswordModal from './RecuperarPasswordModal';
import SplashScreen from './SplashScreen';
import PublicNavbar from '../../components/layout/PublicNavbar';

/** Formato mínimo de correo, para no depender de la validación del navegador. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---- Registro de un cliente nuevo ---------------------------------------
const registroSections = [
  {
    title: 'Datos personales',
    // Orden de identificación del portal: tipo y número de documento,
    // nombre completo y dirección
    fields: [
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: tiposDocumento },
      { key: 'numeroDocumento', label: 'Número de documento', type: 'documento', required: true },
      { key: 'nombre', label: 'Nombre completo', nombrePersona: true, required: true, span: 2 },
      { key: 'direccion', label: 'Dirección', span: 2, placeholder: 'Calle 50 #45-12, Medellín' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: true },
    ],
  },
  {
    title: 'Acceso',
    fields: [
      { key: 'correo', label: 'Correo electrónico', type: 'email', required: true, span: 2 },
      { key: 'password', label: 'Contraseña', type: 'password', required: true, hint: AYUDA_PASSWORD },
      { key: 'password2', label: 'Repite la contraseña', type: 'password', required: true },
    ],
  },
];

/** Reglas que miran varios campos del registro a la vez. */
function validarRegistro(values) {
  const errores = {};
  if (values.correo && !CORREO_VALIDO.test(values.correo)) {
    errores.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com';
  }
  if (values.password && errorPassword(values.password)) {
    errores.password = errorPassword(values.password);
  }
  if (values.password2 && values.password !== values.password2) {
    errores.password2 = 'Las contraseñas no coinciden';
  }
  return errores;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { iniciarSesion, iniciarConGoogle, verificarCodigo, registrarse } = useAuth();
  // ?motivo=inactividad: la sesión se cerró sola por falta de uso
  const [parametros] = useSearchParams();
  const porInactividad = parametros.get('motivo') === 'inactividad';
  // ?motivo=sesion: la cuenta se abrió en otro dispositivo (o la sesión venció)
  const porOtroDispositivo = parametros.get('motivo') === 'sesion';

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  // Pantalla de carga: guarda a dónde ir cuando termine
  const [entrando, setEntrando] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  // Error que devuelve la API (credenciales incorrectas, sin conexión…)
  const [errorApi, setErrorApi] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Token del captcha: sin él no se puede iniciar sesión (ni con Google)
  const [captcha, setCaptcha] = useState('');
  const captchaRef = useRef(null);
  const faltaCaptcha = Boolean(TURNSTILE_SITE_KEY) && !captcha;
  // Segundo paso: la cuenta tiene verificación en dos pasos
  const [desafio, setDesafio] = useState(null);
  const [codigo, setCodigo] = useState('');

  /** Validación propia: el navegador no muestra sus globos por defecto. */
  // Validación en tiempo real: el aviso aparece mientras se escribe (o al
  // salir del campo) y desaparece en cuanto el dato queda bien
  const { errores, tocar, validar } = useValidacion(() => {
    const next = {};
    if (!correo.trim()) next.correo = 'Escribe tu correo electrónico';
    else if (!CORREO_VALIDO.test(correo.trim())) next.correo = 'Escribe un correo válido, por ejemplo nombre@correo.com';
    if (!password) next.password = 'Escribe tu contraseña';
    return next;
  });

  /**
   * Después de entrar se muestra la pantalla de carga y se va a la pantalla
   * que le toca al usuario: la que intentaba abrir antes del login (solo si
   * este usuario tiene permiso para ella: puede ser la de otra persona que
   * usó este navegador) o, si no, su pantalla inicial (portal para
   * clientes, panel para el personal).
   */
  const entrar = (usuario) => {
    const desde = location.state?.desde;
    const destino = desde && puedeAbrir(usuario, desde) ? desde : pantallaInicial(usuario);
    setEntrando({ to: destino, nombre: usuario.nombre.split(' ')[0] });
  };

  /**
   * Primer paso del inicio de sesión (con contraseña o con Google): entra,
   * pide el código del doble factor o muestra el error.
   */
  const iniciar = async (pedirInicio) => {
    if (faltaCaptcha) {
      setErrorApi('Completa la verificación de seguridad (captcha) para continuar.');
      return;
    }
    setEnviando(true);
    setErrorApi('');
    try {
      const resultado = await pedirInicio();
      if (resultado.requiere2fa) {
        // La identidad es correcta, pero falta el código del celular
        setDesafio(resultado.desafio);
        setPassword('');
      } else {
        entrar(resultado.usuario);
      }
    } catch (error) {
      // Contraseña correcta pero cuenta inactiva: pantalla propia
      if (error.datos?.codigo === CODIGO_CUENTA_INACTIVA) {
        navigate('/cuenta-inactiva');
        return;
      }
      setErrorApi(error.message);
    } finally {
      setEnviando(false);
      // El token del captcha sirve una sola vez: se pide otro para el siguiente intento
      captchaRef.current?.reiniciar();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar() || enviando) return;
    iniciar(() => iniciarSesion(correo.trim().toLowerCase(), password, captcha));
  };

  /** Google devolvió la cuenta elegida: la API la verifica. */
  const entrarConGoogle = (credencial) => {
    if (enviando) return;
    iniciar(() => iniciarConGoogle(credencial, captcha));
  };

  /** Segundo paso: envía el código de 6 dígitos de la app autenticadora. */
  const enviarCodigo = async (e) => {
    e.preventDefault();
    if (codigo.length !== 6 || enviando) return;
    setEnviando(true);
    setErrorApi('');
    try {
      entrar(await verificarCodigo(desafio, codigo));
    } catch (error) {
      setErrorApi(error.message);
      setCodigo('');
      // El desafío dura 5 minutos: si venció, se vuelve a pedir la contraseña
      if (error.estado === 401 && /sesión/i.test(error.message)) setDesafio(null);
    } finally {
      setEnviando(false);
    }
  };

  /** El registro crea la cuenta (servicio de sesión) y entra directamente al portal. */
  const crearCuenta = async (values) => {
    try {
      entrar(await registrarse(values, captcha));
    } finally {
      // El token del captcha ya se usó: se pide otro
      captchaRef.current?.reiniciar();
    }
  };

  if (entrando) {
    return <SplashScreen nombre={entrando.nombre} onFinish={() => navigate(entrando.to)} />;
  }

  return (
    <div className="ml-fondo-pastel flex min-h-screen flex-col">
      {/* El mismo menú y pie de la página de inicio */}
      <PublicNavbar />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Panel de marca */}
        <div className="ml-ambiente-marca hidden flex-col justify-between p-12 lg:flex">
          <div>
            <Logo size="lg" tono="oscuro" />
            <h1 className="ml-aparece mt-10 max-w-sm text-4xl font-extrabold leading-tight text-white">
              ERP para tu negocio de llantas
            </h1>
            <p className="ml-aparece mt-4 max-w-sm text-slate-400" style={{ animationDelay: '80ms' }}>
              Gestión completa de ventas, pedidos, reencauche, créditos, entregas y más — en una
              sola plataforma.
            </p>
          </div>
          {/* Llantas de camión */}
          <div className="relative mt-10 flex items-end justify-center">
            <TruckTire className="h-40 w-40 shrink-0 drop-shadow-2xl" />
            <TruckTire className="-ml-8 h-52 w-52 shrink-0 drop-shadow-2xl" />
            <TruckTire className="-ml-8 h-40 w-40 shrink-0 drop-shadow-2xl" />
          </div>
        </div>

        {/* Formulario */}
        <div className="flex items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
          {/* Vidrio pastel sin inclinación: los campos no se mueven al escribir */}
          <LiquidGlass variante="pastel" inclinacion={0} indice={0} className="w-full max-w-md p-6 sm:p-9">
            <div className="mb-8 lg:hidden">
              <Logo size="sm" />
            </div>

            {porInactividad && !desafio && (
              <p className="ml-aparece mb-4 flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Clock size={14} className="shrink-0" /> Tu sesión se cerró por inactividad. Vuelve a ingresar.
              </p>
            )}

            {porOtroDispositivo && !desafio && (
              <p className="ml-aparece mb-4 flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Clock size={14} className="shrink-0" /> Tu sesión se cerró porque la cuenta se abrió en otro dispositivo. Vuelve a ingresar.
              </p>
            )}

            {desafio ? (
              <>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                  <ShieldCheck size={22} className="text-amber-500" /> Verificación
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Escribe el código de 6 dígitos que muestra tu app autenticadora.
                </p>
                <AvisoError mensaje={errorApi} className="ml-aparece mt-4" />
                <form onSubmit={enviarCodigo} noValidate className="mt-6 space-y-4">
                  <CampoCodigo id="lg-codigo" valor={codigo} onCambio={setCodigo} autoFocus />
                  <button
                    type="submit"
                    disabled={enviando || codigo.length !== 6}
                    className="ml-pulsable flex w-full items-center justify-center gap-2 rounded-[14px] bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
                  >
                    {enviando ? 'Verificando…' : 'Verificar'} <ArrowRight size={16} />
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setDesafio(null);
                    setCodigo('');
                    setErrorApi('');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 py-2 text-xs font-semibold text-slate-600 hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-400"
                >
                  <ArrowLeft size={13} /> Volver
                </button>
              </>
            ) : (
              <>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Accede a tu cuenta ERP</p>

              <AvisoError mensaje={errorApi} className="ml-aparece mt-4" />

              {/* noValidate: los avisos los pinta la app, no el navegador */}
              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                <div>
                  <label htmlFor="lg-correo" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lg-correo"
                    type="email"
                    maxLength={80}
                    value={correo}
                    onChange={(e) => {
                      setCorreo(e.target.value);
                      tocar('correo');
                    }}
                    onBlur={() => tocar('correo')}
                    autoComplete="username"
                    placeholder="user@mirallantas.com"
                    aria-invalid={Boolean(errores.correo)}
                    className={`${INPUT} ${errores.correo ? BORDER_ERR : BORDER_OK} mt-1.5 dark:bg-brand-navy-800`}
                  />
                  {errores.correo && (
                    <p className="ml-aparece mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
                      <TriangleAlert size={13} className="shrink-0" /> {errores.correo}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="lg-password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lg-password"
                    type="password"
                    maxLength={72}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      tocar('password');
                    }}
                    onBlur={() => tocar('password')}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(errores.password)}
                    className={`${INPUT} ${errores.password ? BORDER_ERR : BORDER_OK} mt-1.5 dark:bg-brand-navy-800`}
                  />
                  {errores.password && (
                    <p className="ml-aparece mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-500">
                      <TriangleAlert size={13} className="shrink-0" /> {errores.password}
                    </p>
                  )}
                </div>

                {/* Verificación de seguridad: obligatoria para entrar */}
                <Captcha ref={captchaRef} onToken={setCaptcha} />

                <button
                  type="submit"
                  disabled={enviando}
                  className="ml-pulsable flex w-full items-center justify-center gap-2 rounded-[14px] bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
                >
                  {enviando ? 'Ingresando…' : 'Ingresar'} <ArrowRight size={16} />
                </button>
              </form>

              {/* Solo entra quien ya tiene cuenta con ese correo de Google */}
              <BotonGoogle onCredencial={entrarConGoogle} deshabilitado={enviando || faltaCaptcha} />
              {faltaCaptcha && (
                <p className="mt-1.5 text-center text-[11px] text-slate-400">
                  Completa la verificación de seguridad para continuar con Google, recuperar tu contraseña o crear una cuenta.
                </p>
              )}

              {/* ---- Acciones secundarias ---- */}
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setDialogo('recuperar')}
                  disabled={faltaCaptcha}
                  className="py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline text-slate-600 underline-offset-2 hover:text-amber-700 hover:underline dark:text-slate-400 dark:hover:text-amber-400"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <button
                  type="button"
                  onClick={() => setDialogo('registro')}
                  disabled={faltaCaptcha}
                  className="py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                >
                  Crear una cuenta
                </button>
              </div>
              </>
            )}
          </LiquidGlass>
        </div>

        {/* ---- Registro de una cuenta nueva ---- */}
        {dialogo === 'registro' && (
          <FormModal
            mode="create"
            title="Crear una cuenta"
            subtitle="Regístrate para cotizar desde el portal de clientes."
            sections={registroSections}
            validate={validarRegistro}
            submitLabel="Crear cuenta"
            onSubmit={crearCuenta}
            onClose={() => setDialogo(null)}
          />
        )}

        {/* ---- Recuperación de contraseña: correo → código → contraseña nueva ---- */}
        {dialogo === 'recuperar' && <RecuperarPasswordModal onClose={() => setDialogo(null)} />}
      </div>
    </div>
  );
}
