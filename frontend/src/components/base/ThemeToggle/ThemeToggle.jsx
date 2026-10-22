import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { EASE_OUT } from '../../../utils/movimiento';

/**
 * Botón de modo claro/oscuro: círculo de vidrio esmerilado con anillo
 * arcoíris. Solo cambia la apariencia y la transición: el tema se cambia con
 * el mismo `toggleTheme` de siempre (se guarda y se lee igual).
 *
 * Si el navegador tiene View Transitions, el tema nuevo se revela en un
 * círculo que nace del botón. Con "menos movimiento" el cambio es instantáneo.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const boton = useRef(null);

  const cambiar = () => {
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || quieto) {
      toggleTheme();
      return;
    }

    const r = boton.current.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const raiz = document.documentElement;

    // Durante el revelado se apagan las transiciones de color: el círculo
    // ya es la transición, y así la captura nueva sale con los colores finales
    raiz.classList.add('ml-sin-transiciones');
    const transicion = document.startViewTransition(() => {
      flushSync(toggleTheme);
    });
    transicion.ready
      .then(() => {
        raiz.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
          { duration: 450, easing: EASE_OUT, pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {});
    transicion.finished.finally(() => raiz.classList.remove('ml-sin-transiciones'));
  };

  return (
    <button
      ref={boton}
      type="button"
      onClick={cambiar}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={isDark}
      className="ml-tema"
    >
      <span className="ml-tema-brillo" aria-hidden="true" />
      {/* Los dos iconos están siempre: el cambio es un cruce con giro y desenfoque */}
      <Sun size={18} strokeWidth={2} aria-hidden="true" className="ml-tema-icono" data-visible={isDark || undefined} />
      <Moon size={18} strokeWidth={2} aria-hidden="true" className="ml-tema-icono" data-visible={!isDark || undefined} />
    </button>
  );
}
