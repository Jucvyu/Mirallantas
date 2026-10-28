import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { permite, puede } from '../permisos';
import { authService, EVENTO_CUENTA_INACTIVA, EVENTO_SESION_EXPIRADA } from '../services';
import { conectarTiempoReal, desconectarTiempoReal } from '../services/tiempoReal';

const AuthContext = createContext(null);

/** Minutos sin actividad tras los que se cierra la sesión. */
const MINUTOS_INACTIVIDAD = 30;
/** Dónde se anota la última actividad (compartido entre pestañas). */
const CLAVE_ACTIVIDAD = 'mirallantas-ultima-actividad';
/** Eventos que cuentan como actividad del usuario. */
const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

const leerActividad = () => {
  try {
    return Number(localStorage.getItem(CLAVE_ACTIVIDAD)) || Date.now();
  } catch {
    return Date.now();
  }
};

const anotarActividad = () => {
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()));
  } catch {
    // Sin almacenamiento: el cierre por inactividad usa solo esta pestaña
  }
};

/**
 * Sesión del usuario.
 *
 * Guarda quién inició sesión y sus permisos. Toda la comunicación con la
 * API la hace el servicio de sesión (authService); este contexto solo
 * reparte el usuario a las pantallas.
 *
 * Seguridad:
 *   · La sesión se cierra sola tras 30 minutos sin actividad.
 *   · Si la API rechaza el token (expiró, se cerró en otro lado…), se sale.
 *   · Al cerrar sesión la API invalida el token, no solo el navegador.
 *
 * Expone:
 *   usuario            datos del usuario en sesión, o null
 *   cargando           true mientras se valida la sesión guardada
 *   iniciarSesion      (correo, password, captcha) → { usuario } | { requiere2fa, desafio }
 *   iniciarConGoogle   (credencial de Google, captcha) → igual que iniciarSesion
 *   verificarCodigo    (desafio, codigo) → usuario
 *   registrarse        (valores del formulario, captcha) → usuario (cuenta de cliente)
 *   cerrarSesion       (motivo?)
 *   puede              (módulo, 'crear' | 'editar' | 'eliminar') → boolean (nivel 3)
 *   actualizarPerfil   (valores del formulario) → usuario
 *   activarDobleFactor / desactivarDobleFactor
 *   tienePermiso       (modulo) → boolean
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Si hay una sesión guardada, hay que validarla antes de mostrar nada
  const [cargando, setCargando] = useState(() => authService.haySesionGuardada());

  /**
   * Cierra la sesión y vuelve al login (o al inicio). Se recarga la app
   * completa a propósito: así no queda en memoria ningún dato de la sesión
   * anterior (carrito, listados…) si después entra otra persona.
   */
  const cerrarSesion = useCallback(async (motivo) => {
    await authService.cerrarSesion();
    window.location.assign(motivo ? `/login?motivo=${motivo}` : '/');
  }, []);

  // ---- Al abrir la app: ¿la sesión guardada sigue viva? -------------------
  useEffect(() => {
    if (!authService.haySesionGuardada()) return;
    // Si se fue hace más de 30 minutos, la sesión ya no vale
    if (Date.now() - leerActividad() > MINUTOS_INACTIVIDAD * 60_000) {
      authService.cerrarSesion().finally(() => setCargando(false));
      return;
    }
    authService
      .usuarioActual()
      .then(setUsuario)
      .catch(() => authService.olvidarSesion()) // si está inactiva, http.js ya avisó
      .finally(() => setCargando(false));
  }, []);

  // ---- Si la API rechaza el token en cualquier pantalla, se cierra -------
  useEffect(() => {
    // La API rechazó el token (se abrió la cuenta en otro dispositivo o venció):
    // al login, con el aviso de por qué
    const alExpirar = () => {
      setUsuario(null);
      window.location.assign('/login?motivo=sesion');
    };
    // Si lo desactivaron con la sesión abierta, se le explica en su pantalla
    const alDesactivar = () => window.location.assign('/cuenta-inactiva');
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    window.addEventListener(EVENTO_CUENTA_INACTIVA, alDesactivar);
    return () => {
      window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
      window.removeEventListener(EVENTO_CUENTA_INACTIVA, alDesactivar);
    };
  }, []);

  // ---- Tiempo real: conectado mientras haya sesión ------------------------
  useEffect(() => {
    if (!usuario) return undefined;
    conectarTiempoReal();
    return desconectarTiempoReal;
  }, [usuario]);

  // ---- Cierre por inactividad ---------------------------------------------
  useEffect(() => {
    if (!usuario) return undefined;
    anotarActividad();
    // Anotar a lo sumo una vez cada 15 s para no escribir en cada movimiento
    let ultimaAnotacion = Date.now();
    const alActuar = () => {
      if (Date.now() - ultimaAnotacion > 15_000) {
        ultimaAnotacion = Date.now();
        anotarActividad();
      }
    };
    EVENTOS_ACTIVIDAD.forEach((ev) => window.addEventListener(ev, alActuar, { passive: true }));
    const revisar = setInterval(() => {
      if (Date.now() - leerActividad() > MINUTOS_INACTIVIDAD * 60_000) cerrarSesion('inactividad');
    }, 30_000);
    return () => {
      EVENTOS_ACTIVIDAD.forEach((ev) => window.removeEventListener(ev, alActuar));
      clearInterval(revisar);
    };
  }, [usuario, cerrarSesion]);

  const iniciarSesion = useCallback(async (correo, password, captcha) => {
    const resultado = await authService.iniciarSesion(correo, password, captcha);
    if (resultado.usuario) setUsuario(resultado.usuario);
    return resultado;
  }, []);

  const iniciarConGoogle = useCallback(async (credencial, captcha) => {
    const resultado = await authService.iniciarConGoogle(credencial, captcha);
    if (resultado.usuario) setUsuario(resultado.usuario);
    return resultado;
  }, []);

  const verificarCodigo = useCallback(async (desafio, codigo) => {
    const nuevo = await authService.verificarCodigo(desafio, codigo);
    setUsuario(nuevo);
    return nuevo;
  }, []);

  const registrarse = useCallback(async (valores, captcha) => {
    const nuevo = await authService.registrarse(valores, captcha);
    setUsuario(nuevo);
    return nuevo;
  }, []);

  const actualizarPerfil = useCallback(
    async (valores) => {
      const actualizado = await authService.actualizarPerfil(valores, usuario);
      setUsuario(actualizado);
      return actualizado;
    },
    [usuario],
  );

  const activarDobleFactor = useCallback(async (codigo) => {
    const actualizado = await authService.activarDobleFactor(codigo);
    setUsuario(actualizado);
    return actualizado;
  }, []);

  const desactivarDobleFactor = useCallback(async (passwordActual, codigo) => {
    const actualizado = await authService.desactivarDobleFactor(passwordActual, codigo);
    setUsuario((u) => ({ ...u, ...actualizado }));
    return actualizado;
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      iniciarConGoogle,
      verificarCodigo,
      registrarse,
      cerrarSesion,
      actualizarPerfil,
      activarDobleFactor,
      desactivarDobleFactor,
      tienePermiso: (modulo) => permite(usuario, modulo),
      // Nivel 3: ¿puede crear, editar o eliminar en ese módulo?
      puede: (modulo, accion) => puede(usuario, modulo, accion),
    }),
    [
      usuario,
      cargando,
      iniciarSesion,
      iniciarConGoogle,
      verificarCodigo,
      registrarse,
      cerrarSesion,
      actualizarPerfil,
      activarDobleFactor,
      desactivarDobleFactor,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Acceso a la sesión desde cualquier componente. */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  return contexto;
}
