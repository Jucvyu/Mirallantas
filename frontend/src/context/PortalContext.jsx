import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CUPO_CARTERA } from '../constantes';
import { portalService } from '../services';

const PortalContext = createContext(null);

/** Estado inicial mientras llegan los datos. */
const VACIO = {
  esCliente: false,
  cupoTotal: CUPO_CARTERA,
  cotizaciones: [],
  creditos: [],
  abonos: [],
  solicitudesCredito: [],
  estadisticas: null,
};

/**
 * Datos del portal del cliente en sesión.
 *
 * Al entrar al portal se le pide todo al servicio del portal de una vez:
 * cotizaciones con sus líneas, créditos, abonos, solicitudes de crédito e
 * indicadores del inicio. Todas las pantallas del portal leen de aquí, y
 * después de registrar algo (una cotización, un abono…) se llama a
 * `recargar()` para ver el cambio.
 */
export function PortalProvider({ children }) {
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Primera carga al entrar al portal. `vigente` evita guardar una
  // respuesta que llega cuando el portal ya se cerró.
  useEffect(() => {
    let vigente = true;
    portalService
      .resumen()
      .then((resumen) => vigente && setDatos(resumen))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  /** Vuelve a pedir los datos (después de registrar algo). */
  const recargar = useCallback(async () => {
    try {
      setDatos(await portalService.resumen());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const valor = useMemo(() => ({ ...datos, cargando, error, recargar }), [datos, cargando, error, recargar]);

  return <PortalContext.Provider value={valor}>{children}</PortalContext.Provider>;
}

/** Acceso a los datos del portal desde cualquier pantalla del portal. */
export function usePortal() {
  const contexto = useContext(PortalContext);
  if (!contexto) throw new Error('usePortal debe usarse dentro de un <PortalProvider>');
  return contexto;
}
