import { useState } from 'react';

/**
 * Maneja el envío de un formulario a la API.
 *
 *   const { enviando, errorEnvio, enviar } = useEnvio();
 *   <button disabled={enviando} onClick={() => enviar(() => guardarEnApi(), close)}>
 *
 * - `enviando` es true mientras la API responde: sirve para deshabilitar
 *   el botón y que el usuario no guarde dos veces el mismo registro.
 * - Si la API responde con error, `errorEnvio` trae el mensaje y el
 *   formulario NO se cierra, para que el usuario pueda corregir.
 * - Si todo sale bien, se llama a `alTerminar` (normalmente, cerrar el modal).
 */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const enviar = async (accion, alTerminar) => {
    if (enviando) return; // Evita el doble envío
    setEnviando(true);
    setErrorEnvio('');
    try {
      await accion();
      alTerminar?.();
    } catch (error) {
      setErrorEnvio(error.message);
    } finally {
      setEnviando(false);
    }
  };

  return { enviando, errorEnvio, setErrorEnvio, enviar };
}
