import { useEffect, useRef } from 'react';
import { EVENTO_CAMBIO } from '../services/tiempoReal';

/** Los avisos que llegan seguidos se atienden una sola vez. */
const ESPERA_MS = 250;

/**
 * Llama a `alCambiar` cuando la API avisa que cambiaron datos (tiempo
 * real) y cuando se vuelve a la pestaña después de dejarla de lado.
 *
 *   useAlCambiar(recargar);
 *
 * La función puede cambiar en cada render: siempre se llama la última.
 */
export function useAlCambiar(alCambiar) {
  const funcion = useRef(alCambiar);
  useEffect(() => {
    funcion.current = alCambiar;
  });

  useEffect(() => {
    let temporizador = null;
    const programar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => funcion.current?.(), ESPERA_MS);
    };
    const alVolver = () => document.visibilityState === 'visible' && programar();
    window.addEventListener(EVENTO_CAMBIO, programar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener(EVENTO_CAMBIO, programar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
