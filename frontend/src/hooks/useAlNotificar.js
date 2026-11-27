import { useEffect, useRef } from 'react';
import { EVENTO_NOTIFICACION } from '../services/tiempoReal';

/** Varias notificaciones seguidas se atienden una sola vez. */
const ESPERA_MS = 300;

/**
 * Llama a `alNotificar` cuando la API avisa (tiempo real) que llegó una
 * notificación nueva para esta sesión. En una pestaña oculta se anota y se
 * atiende al volver a ella.
 */
export function useAlNotificar(alNotificar) {
  const funcion = useRef(alNotificar);
  useEffect(() => {
    funcion.current = alNotificar;
  });

  useEffect(() => {
    let temporizador = null;
    let pendiente = false;
    const programar = () => {
      if (document.visibilityState === 'hidden') {
        pendiente = true;
        return;
      }
      clearTimeout(temporizador);
      temporizador = setTimeout(() => funcion.current?.(), ESPERA_MS);
    };
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || !pendiente) return;
      pendiente = false;
      programar();
    };
    window.addEventListener(EVENTO_NOTIFICACION, programar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener(EVENTO_NOTIFICACION, programar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
