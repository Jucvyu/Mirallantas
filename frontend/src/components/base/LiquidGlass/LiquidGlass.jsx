import { useEffect, useRef, useState } from 'react';
import { EASE_OUT } from '../../../utils/movimiento';

/**
 * LiquidGlass · superficie de vidrio de Mirallantas.
 *
 * Un solo componente para todas las tarjetas y paneles de vidrio; el aspecto
 * cambia con `variante` y el comportamiento con props:
 *
 *   variante     'pastel'     vidrio claro azul cielo (landing, login, tarjetas generales)
 *                'industrial' vidrio teñido del azul del dashboard (admin)
 *                'panel'      superficie opaca para modales (el texto manda)
 *                'neutra'     sin superficie propia: solo la interacción, para
 *                             tarjetas que ya tienen sus colores de estado
 *   inclinacion  grados máximos que se inclina hacia el cursor (0 = nada)
 *   blur         false en listas largas: vidrio sin desenfoque (más barato)
 *   pulsable     cede a scale(0.97) al presionarla
 *   indice       posición en la entrada escalonada (solo la primera visita a la página)
 *   as           elemento o componente a renderizar (div, article, Link…)
 *
 * Interacción (solo con ratón: `(hover: hover) and (pointer: fine)`):
 * inclinación 3D, reflejo especular y canto iluminado que siguen al cursor,
 * y parallax en los hijos marcados con `data-capa`. Un solo juego de
 * listeners por tarjeta y ningún setState: se escribe `transform` en el
 * elemento en un bucle de requestAnimationFrame que se apaga al salir.
 */

const CON_RATON = '(hover: hover) and (pointer: fine)';
const MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';
/** Regreso al reposo al salir el cursor. */
const REGRESO = `transform 350ms ${EASE_OUT}`;
/** Rapidez del seguimiento (amortiguado exponencial, ~80 ms). */
const RAPIDEZ = 12;
/** Desplazamiento de las capas con parallax por cada grado de inclinación. */
const PARALLAX = 0.7;

// Rutas que ya hicieron su entrada: al volver a ellas no se repite.
const rutasVistas = new Set();

function usarEntrada() {
  const ruta = window.location.pathname;
  if (rutasVistas.has(ruta)) return false;
  // Todas las tarjetas que se montan en el primer segundo entran escalonadas
  setTimeout(() => rutasVistas.add(ruta), 1000);
  return true;
}

export default function LiquidGlass({
  as: Elemento = 'div',
  variante = 'pastel',
  inclinacion = 6,
  blur = true,
  pulsable = false,
  indice,
  className = '',
  style,
  children,
  ref: refExterno,
  ...resto
}) {
  const nodo = useRef(null);
  const capa = useRef(null);
  const mancha = useRef(null);
  const canto = useRef(null);
  // Se decide una sola vez, al montar: ¿esta tarjeta hace la entrada escalonada?
  const [entra] = useState(() => indice !== undefined && usarEntrada());

  const asignarRef = (el) => {
    nodo.current = el;
    if (typeof refExterno === 'function') refExterno(el);
    else if (refExterno) refExterno.current = el;
  };

  useEffect(() => {
    const el = nodo.current;
    if (!el || !window.matchMedia(CON_RATON).matches) return undefined;
    const quieto = window.matchMedia(MENOS_MOVIMIENTO).matches;
    // Nodos de la capa de brillo (fijos mientras la tarjeta está montada)
    const capaEl = capa.current;
    const manchaEl = mancha.current;
    const cantoEl = canto.current;
    let temporizador = 0;

    let rect = null;
    let capas = [];
    let cuadro = 0;
    let anterior = 0;
    // estado actual y objetivo: inclinación (x, y), escala y posición del reflejo
    let rx = 0, ry = 0, s = 1, bx = 0, by = 0;
    let objRx = 0, objRy = 0, objS = 1, objBx = 0, objBy = 0;

    const pintar = (ahora) => {
      const dt = Math.min((ahora - anterior) / 1000, 1 / 30);
      anterior = ahora;
      const k = 1 - Math.exp(-RAPIDEZ * dt);
      rx += (objRx - rx) * k;
      ry += (objRy - ry) * k;
      s += (objS - s) * k;
      bx += (objBx - bx) * k;
      by += (objBy - by) * k;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`;
      manchaEl.style.transform = `translate3d(${bx}px, ${by}px, 0) translate(-50%, -50%)`;
      cantoEl.style.setProperty('--x', `${bx}px`);
      cantoEl.style.setProperty('--y', `${by}px`);
      for (const c of capas) c.style.transform = `translate3d(${ry * PARALLAX}px, ${-rx * PARALLAX}px, 0)`;
      const falta = Math.abs(objRx - rx) + Math.abs(objRy - ry) + Math.abs(objS - s) + Math.abs(objBx - bx) + Math.abs(objBy - by);
      cuadro = falta > 0.05 ? requestAnimationFrame(pintar) : 0;
    };
    const arrancar = () => {
      if (!cuadro) {
        anterior = performance.now();
        cuadro = requestAnimationFrame(pintar);
      }
    };

    const apuntar = (e) => {
      objBx = e.clientX - rect.left;
      objBy = e.clientY - rect.top;
      // Mientras se arrastra una tarjeta del dashboard, las demás no se inclinan
      const max = document.body.dataset.arrastrando ? 0 : inclinacion;
      objRy = (objBx / rect.width - 0.5) * 2 * max;
      objRx = -(objBy / rect.height - 0.5) * 2 * max;
    };

    const entrar = (e) => {
      rect = el.getBoundingClientRect();
      capaEl.dataset.activo = '';
      apuntar(e);
      bx = objBx;
      by = objBy;
      if (quieto) {
        // Menos movimiento: el reflejo aparece (opacidad) pero no se mueve
        manchaEl.style.transform = `translate3d(${bx}px, ${by}px, 0) translate(-50%, -50%)`;
        cantoEl.style.setProperty('--x', `${bx}px`);
        cantoEl.style.setProperty('--y', `${by}px`);
        return;
      }
      capas = [...el.querySelectorAll('[data-capa]')];
      el.style.transition = 'none';
      el.style.willChange = 'transform';
      manchaEl.style.willChange = 'transform';
      for (const c of capas) {
        c.style.transition = 'none';
        c.style.willChange = 'transform';
      }
      arrancar();
    };
    const mover = (e) => {
      if (!rect || quieto) return;
      apuntar(e);
      arrancar();
    };
    const presionar = () => {
      if (!pulsable || quieto) return;
      objS = 0.97;
      arrancar();
    };
    const soltar = () => {
      if (!pulsable || quieto) return;
      objS = 1;
      arrancar();
    };
    const salir = () => {
      delete capaEl.dataset.activo;
      rect = null;
      if (quieto) return;
      cancelAnimationFrame(cuadro);
      cuadro = 0;
      rx = ry = 0;
      s = objS = 1;
      // Regreso al reposo con una curva ease-out fuerte, por CSS
      el.style.transition = REGRESO;
      el.style.transform = '';
      for (const c of capas) {
        c.style.transition = REGRESO;
        c.style.transform = '';
      }
      const limpiar = () => {
        if (rect) return; // volvió a entrar antes de terminar
        el.style.willChange = '';
        el.style.transition = '';
        manchaEl.style.willChange = '';
        for (const c of capas) {
          c.style.willChange = '';
          c.style.transition = '';
        }
      };
      clearTimeout(temporizador);
      temporizador = setTimeout(limpiar, 370);
    };

    el.addEventListener('pointerenter', entrar);
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerleave', salir);
    el.addEventListener('pointerdown', presionar);
    el.addEventListener('pointerup', soltar);
    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(temporizador);
      el.removeEventListener('pointerenter', entrar);
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerleave', salir);
      el.removeEventListener('pointerdown', presionar);
      el.removeEventListener('pointerup', soltar);
    };
  }, [inclinacion, pulsable]);

  const clases = [
    'ml-lg',
    `ml-lg--${variante}`,
    variante === 'panel' ? 'ml-glass-panel' : '',
    blur ? '' : 'ml-lg--sin-blur',
    pulsable ? 'ml-lg--pulsable' : '',
    entra ? 'ml-lg--entra' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Elemento
      ref={asignarRef}
      className={clases}
      style={entra ? { animationDelay: `${indice * 40}ms`, ...style } : style}
      {...resto}
    >
      <span ref={capa} className="ml-brillo" aria-hidden="true">
        <span ref={mancha} className="ml-brillo-mancha" />
        <span ref={canto} className="ml-brillo-canto" />
      </span>
      {children}
    </Elemento>
  );
}
