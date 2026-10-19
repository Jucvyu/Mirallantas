import { useState } from 'react';
import { LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import AvisoError from '../../components/base/AvisoError';
import Logo from '../../components/base/Logo';
import Modal from '../../components/base/Modal';
import { BORDER_OK, INPUT } from '../../components/base/formStyles';
import { useAuth } from '../../context/AuthContext';
import { useEnvio } from '../../hooks/useEnvio';
import { authService } from '../../services';

// =========================================================================
// Verificación en dos pasos (doble factor).
//
// Además de la contraseña, al iniciar sesión se pide un código de 6 dígitos
// que genera una app del celular (Google Authenticator, Microsoft
// Authenticator, Authy…). Aunque alguien robe la contraseña, sin el
// celular no puede entrar.
// =========================================================================

/** Solo deja escribir dígitos, máximo 6. */
const soloSeisDigitos = (texto) => texto.replace(/\D/g, '').slice(0, 6);

/** Campo para el código de 6 dígitos. */
export function CampoCodigo({ id, valor, onCambio, autoFocus = false }) {
  return (
    <input
      id={id}
      value={valor}
      onChange={(e) => onCambio(soloSeisDigitos(e.target.value))}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      placeholder="000000"
      aria-label="Código de 6 dígitos"
      className={`${INPUT} ${BORDER_OK} text-center font-mono text-lg tracking-[0.5em]`}
    />
  );
}

/**
 * Pasos para activar el doble factor: generar el QR, escanearlo y
 * confirmar con el primer código.
 */
function ConfigurarDosFactores({ onActivado }) {
  const { activarDobleFactor } = useAuth();
  const [qr, setQr] = useState(null);
  const [secreto, setSecreto] = useState('');
  const [codigo, setCodigo] = useState('');
  const { enviando, errorEnvio: error, enviar } = useEnvio();

  const generar = () =>
    enviar(async () => {
      const datos = await authService.configurarDobleFactor();
      setSecreto(datos.secreto);
      setQr(await QRCode.toDataURL(datos.direccion, { margin: 1, width: 200 }));
    });

  const activar = () => {
    if (codigo.length !== 6) return;
    enviar(async () => {
      await activarDobleFactor(codigo);
      onActivado?.();
    });
  };

  return (
    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
      <AvisoError mensaje={error} />
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Instala en tu celular una app autenticadora (Google Authenticator, Microsoft Authenticator o Authy).</li>
        <li>Genera el código QR y escanéalo con la app.</li>
        <li>Escribe el código de 6 dígitos que muestra la app.</li>
      </ol>

      {!qr ? (
        <button
          type="button"
          onClick={generar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
        >
          <Smartphone size={16} /> {enviando ? 'Generando…' : 'Generar código QR'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <img src={qr} alt="Código QR para la app autenticadora" className="h-48 w-48 rounded-lg bg-white p-2" />
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              ¿No puedes escanear? Escribe esta clave en la app:
              <span className="mt-1 block break-all font-mono text-[11px] text-slate-700 dark:text-slate-200">{secreto}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <CampoCodigo id="codigo-2fa" valor={codigo} onCambio={setCodigo} autoFocus />
            <button
              type="button"
              onClick={activar}
              disabled={enviando || codigo.length !== 6}
              className="shrink-0 rounded-lg bg-amber-400 px-4 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-50"
            >
              Activar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Desactivar: pide la contraseña y un código vigente. */
function DesactivarDosFactores({ onDesactivado }) {
  const { desactivarDobleFactor } = useAuth();
  const [passwordActual, setPasswordActual] = useState('');
  const [codigo, setCodigo] = useState('');
  const { enviando, errorEnvio: error, enviar } = useEnvio();

  const desactivar = () =>
    enviar(async () => {
      await desactivarDobleFactor(passwordActual, codigo);
      onDesactivado?.();
    });

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-white/10">
      <AvisoError mensaje={error} />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Para desactivarla confirma tu contraseña y un código de la app.
      </p>
      <input
        type="password"
        value={passwordActual}
        onChange={(e) => setPasswordActual(e.target.value)}
        placeholder="Contraseña actual"
        autoComplete="current-password"
        className={`${INPUT} ${BORDER_OK}`}
      />
      <CampoCodigo id="codigo-desactivar" valor={codigo} onCambio={setCodigo} />
      <button
        type="button"
        onClick={desactivar}
        disabled={enviando || !passwordActual || codigo.length !== 6}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        Desactivar verificación en dos pasos
      </button>
    </div>
  );
}

/** Modal "Seguridad de la cuenta", que se abre desde el menú del perfil. */
export function DosFactoresModal({ onClose }) {
  const { usuario } = useAuth();

  return (
    <Modal
      title="Verificación en dos pasos"
      subtitle="Protege tu cuenta con un código del celular además de la contraseña."
      icon={<ShieldCheck size={17} />}
      size="md"
      onClose={onClose}
    >
      {usuario.dosFactores ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={16} /> Activa: al iniciar sesión se pedirá el código de tu app.
          </p>
          {/* Si la empresa la vuelve obligatoria (EXIGIR_2FA_ADMIN), la API
              no deja desactivarla y muestra el motivo */}
          <DesactivarDosFactores onDesactivado={onClose} />
        </div>
      ) : (
        <ConfigurarDosFactores onActivado={onClose} />
      )}
    </Modal>
  );
}

/**
 * Pantalla que bloquea el panel hasta que el Administrador active la
 * verificación en dos pasos (la API tampoco le responde nada más).
 */
export function DosFactoresObligatorio() {
  const { cerrarSesion } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-brand-navy-900">
      <div className="ml-aparece w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-brand-navy-800">
        <Logo size="sm" />
        <h1 className="mt-6 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <ShieldCheck size={20} className="text-amber-500" /> Activa la verificación en dos pasos
        </h1>
        <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
          Las cuentas de Administrador controlan todo el sistema. Antes de entrar al panel, protege la
          tuya con un código del celular.
        </p>
        <ConfigurarDosFactores />
        <button
          type="button"
          onClick={() => cerrarSesion()}
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
