import { useEffect, useRef } from 'react';
import { afecta, EVENTO_CAMBIO } from '../services/tiempoReal';

/** Los avisos que llegan seguidos se atienden una sola vez. */
const ESPERA_MS = 400;
/** Con cambios sin pausa, igual se recarga al menos cada tanto. */
const ESPERA_MAXIMA_MS = 2000;

/**
 * Llama a `alCambiar` cuando la API avisa (tiempo real) que cambiaron datos
 * de los que depende la pantalla.
 *
 *   useAlCambiar(recargar, ['cotizaciones']);   // solo lo que afecta a cotizaciones
 *   useAlCambiar(recargar);                     // cualquier cambio
 *
 * Para no saturar la API:
 * - los avisos seguidos se juntan en una sola recarga (ESPERA_MS), pero
 *   si no paran de llegar se recarga igual cada ESPERA_MAXIMA_MS;
 * - en una pestaña oculta no se recarga: se anota y se recarga una vez al
 *   volver a ella.
 *
 * La función puede cambiar en cada render: siempre se llama la última.
 */
export function useAlCambiar(alCambiar, recursos) {
  const funcion = useRef(alCambiar);
  const mira = useRef(recursos);
  useEffect(() => {
    funcion.current = alCambiar;
    mira.current = recursos;
  });

  useEffect(() => {
    let temporizador = null;
    let pendiente = false;
    // Cuándo llegó el primer aviso que todavía no se atiende
    let desde = null;
    const recargar = () => {
      desde = null;
      funcion.current?.();
    };
    const programar = () => {
      if (document.visibilityState === 'hidden') {
        pendiente = true;
        return;
      }
      clearTimeout(temporizador);
      desde ??= Date.now();
      temporizador = setTimeout(recargar, Math.max(0, Math.min(ESPERA_MS, desde + ESPERA_MAXIMA_MS - Date.now())));
    };
    const alCambio = (evento) => afecta(evento.detail?.recursos, mira.current) && programar();
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || !pendiente) return;
      pendiente = false;
      programar();
    };
    window.addEventListener(EVENTO_CAMBIO, alCambio);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener(EVENTO_CAMBIO, alCambio);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
