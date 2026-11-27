import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Envuelve una acción de un botón: si devuelve una promesa (una petición a
 * la API), marca `procesando` hasta que termine e ignora los clics que
 * lleguen mientras tanto. Una acción que no devuelve promesa (p. ej. abrir
 * un modal) no muestra carga.
 *
 *   const [procesando, ejecutar] = useProcesando(onClick);
 *   <button disabled={procesando} onClick={() => ejecutar()}>…</button>
 */
export function useProcesando(accion) {
  const [procesando, setProcesando] = useState(false);
  const enCurso = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const ejecutar = useCallback(
    (...args) => {
      if (enCurso.current || !accion) return undefined;
      const resultado = accion(...args);
      if (!resultado || typeof resultado.then !== 'function') return resultado;
      enCurso.current = true;
      setProcesando(true);
      return Promise.resolve(resultado).finally(() => {
        enCurso.current = false;
        if (montado.current) setProcesando(false);
      });
    },
    [accion],
  );

  return [procesando, ejecutar];
}
