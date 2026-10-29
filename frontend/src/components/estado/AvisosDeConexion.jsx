import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ServerCrash, WifiOff } from 'lucide-react';
import PantallaEstado, { BOTON_PRINCIPAL } from '../base/PantallaEstado';
import { EVENTO_SERVIDOR_CAIDO, servidorDisponible } from '../../services';
import { servidorCaidoAlIniciar } from '../../services/http';
import { EVENTO_CAMBIO } from '../../services/tiempoReal';

/** Cada cuántos segundos se vuelve a probar el servidor. */
const REINTENTO_S = 5;

/** Al volver la conexión, todas las pantallas recargan sus datos. */
const recargarDatos = () => window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO, { detail: { recursos: ['*'] } }));

/**
 * Avisos de conexión a pantalla completa, encima de la aplicación (lo que
 * había debajo no se pierde):
 *
 *   · Sin internet: aparece en cuanto el navegador pierde la red y se quita
 *     sola al volver.
 *   · Servidor no disponible: aparece cuando la API no responde (o el
 *     proveedor contesta 502/503/504). Prueba sola cada pocos segundos y,
 *     cuando responde, se quita.
 *
 * En los dos casos, al volver se recargan los datos de las pantallas.
 */
export default function AvisosDeConexion() {
  const [sinInternet, setSinInternet] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [servidorCaido, setServidorCaido] = useState(servidorCaidoAlIniciar);
  const [segundos, setSegundos] = useState(REINTENTO_S);
  const [probando, setProbando] = useState(false);

  // ---- Internet ----
  useEffect(() => {
    const alPerder = () => setSinInternet(true);
    const alVolver = () => {
      setSinInternet(false);
      recargarDatos();
    };
    window.addEventListener('offline', alPerder);
    window.addEventListener('online', alVolver);
    return () => {
      window.removeEventListener('offline', alPerder);
      window.removeEventListener('online', alVolver);
    };
  }, []);

  // ---- Servidor ----
  useEffect(() => {
    const alCaer = () => setServidorCaido(true);
    window.addEventListener(EVENTO_SERVIDOR_CAIDO, alCaer);
    return () => window.removeEventListener(EVENTO_SERVIDOR_CAIDO, alCaer);
  }, []);

  /** Prueba el servidor; si responde, se quita el aviso. */
  const probar = useCallback(async () => {
    setProbando(true);
    const disponible = await servidorDisponible();
    setProbando(false);
    setSegundos(REINTENTO_S);
    if (disponible) {
      setServidorCaido(false);
      recargarDatos();
    }
  }, []);

  // Cuenta regresiva y prueba automática mientras el servidor no responde
  useEffect(() => {
    if (!servidorCaido || sinInternet) return undefined;
    const id = setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          probar();
          return REINTENTO_S;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [servidorCaido, sinInternet, probar]);

  if (sinInternet) {
    return (
      <PantallaEstado
        superpuesta
        icono={WifiOff}
        tono="ambar"
        titulo="No tienes conexión a internet"
        mensaje="Revisa tu red Wi-Fi o tus datos móviles. En cuanto vuelva la conexión, MiraLlantas continúa donde ibas."
      >
        <button type="button" onClick={() => navigator.onLine && setSinInternet(false)} className={BOTON_PRINCIPAL}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </PantallaEstado>
    );
  }

  if (servidorCaido) {
    return (
      <PantallaEstado
        superpuesta
        icono={ServerCrash}
        tono="rojo"
        codigo="503"
        titulo="El servidor no está disponible"
        mensaje="No pudimos comunicarnos con MiraLlantas. Puede estar en mantenimiento o reiniciándose; lo intentamos de nuevo automáticamente."
      >
        <button type="button" onClick={probar} disabled={probando} className={BOTON_PRINCIPAL}>
          <RefreshCw size={16} className={probando ? 'animate-spin' : ''} />
          {probando ? 'Probando…' : `Reintentar ahora (${segundos} s)`}
        </button>
      </PantallaEstado>
    );
  }

  return null;
}
