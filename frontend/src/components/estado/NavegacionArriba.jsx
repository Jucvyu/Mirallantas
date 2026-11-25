import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Cuánto se espera a que la pantalla cargue sus datos para encontrar el registro. */
const ESPERA_MAXIMA_MS = 6000;
const DURACION_PARPADEO_MS = 2600;

/**
 * Busca en la pantalla el registro que trae `codigo` (REE-2026-001,
 * PED-2026-014…) y lo hace parpadear. Prefiere la fila de una tabla y luego
 * la tarjeta; si no está (p. ej. la llanta dentro de un grupo plegado),
 * prueba con el número de la solicitud (sin el "-1" final).
 */
function buscarRegistro(codigo) {
  const zona = document.querySelector('main') ?? document.body;
  const candidatos = [codigo, codigo.replace(/-\d+$/, '')].filter((c, i, l) => c && l.indexOf(c) === i);
  for (const c of candidatos) {
    for (const selector of ['[data-resaltable]', 'tr', 'article', 'li']) {
      const hallado = [...zona.querySelectorAll(selector)].find((el) => el.textContent.includes(c));
      if (hallado) return hallado;
    }
  }
  return null;
}

/**
 * Comportamiento común al cambiar de pantalla:
 *   · cada pantalla nueva empieza arriba (al volver atrás, el navegador
 *     conserva donde estaba);
 *   · si se llegó desde una notificación (`state.resaltar`), el registro
 *     al que se refiere se desplaza a la vista y parpadea.
 */
export default function NavegacionArriba() {
  const { pathname, state, key } = useLocation();
  const tipo = useNavigationType();

  useLayoutEffect(() => {
    if (tipo !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, tipo]);

  const resaltar = state?.resaltar;
  useEffect(() => {
    if (!resaltar) return undefined;
    let elemento = null;
    let temporizador = null;
    const inicio = Date.now();
    const intentar = () => {
      elemento = buscarRegistro(resaltar);
      if (!elemento) {
        if (Date.now() - inicio < ESPERA_MAXIMA_MS) temporizador = setTimeout(intentar, 200);
        return;
      }
      elemento.scrollIntoView({ block: 'center', behavior: 'smooth' });
      elemento.classList.remove('ml-parpadeo');
      // Fuerza a reiniciar la animación si ya la tenía
      void elemento.offsetWidth;
      elemento.classList.add('ml-parpadeo');
      temporizador = setTimeout(() => elemento?.classList.remove('ml-parpadeo'), DURACION_PARPADEO_MS);
    };
    temporizador = setTimeout(intentar, 120);
    return () => {
      clearTimeout(temporizador);
      elemento?.classList.remove('ml-parpadeo');
    };
    // `key` cambia en cada clic, aunque sea la misma notificación
  }, [resaltar, key]);

  return null;
}
